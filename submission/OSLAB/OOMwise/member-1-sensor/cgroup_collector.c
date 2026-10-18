#include "include/sensor.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <ctype.h>
#include <unistd.h>
#include <sys/stat.h>
#include <time.h>
#include <inttypes.h>
typedef struct {char path[MAX_PATH];uint64_t refault;double last_s;bool valid;char restart[64];int64_t delay;bool has_delay;double last_policy_s;bool has_restart;} CGCache;
static CGCache caches[MAX_CGROUPS];
static int policy_budget=0;
static void make_path(char *dst,size_t cap,const char *group,const char *file){snprintf(dst,cap,"/sys/fs/cgroup%s%s%s",!strcmp(group,"/")?"":group,"/",file);}
static bool mem_stat(const char *text,const char *key,uint64_t *out){const char *p=text;size_t n=strlen(key);while(*p){if(!strncmp(p,key,n)&&p[n]==' '){unsigned long long v;if(sscanf(p+n+1,"%llu",&v)==1){*out=v;return true;}}const char *q=strchr(p,'\n');if(!q)break;p=q+1;}return false;}
static bool parse_psi(const char *b,const char *kind,double *v){const char *p=b;while(*p){if(!strncmp(p,kind,strlen(kind))&&p[strlen(kind)]==' '){return sscanf(p+strlen(kind)," avg10=%lf",v)==1;}const char *q=strchr(p,'\n');if(!q)break;p=q+1;}return false;}
static bool read_limit(const char *path,int64_t *v){char b[64];if(read_text(path,b,sizeof b)<0||!strncmp(b,"max",3))return false;char *e;long long k=strtoll(b,&e,10);if(e==b||k<0)return false;*v=k;return true;}
static void restart_info(Cgroup *c,CGCache *cache,double now){
 if(!c->has_unit)return;
 if((cache->last_policy_s==0||now-cache->last_policy_s>=10)&&policy_budget<2){
  policy_budget++;
  /* no user-supplied unit is ever treated as a shell expression; only systemd-derived unit basename */
  bool safe=true;for(const char *p=c->unit;*p;p++)if(!isalnum((unsigned char)*p)&&*p!='_'&&*p!='.'&&*p!='-'&&*p!='@')safe=false;
  if(safe){char cmd[384];snprintf(cmd,sizeof cmd,"systemctl show -p Restart -p RestartUSec -- '%s' 2>/dev/null",c->unit);
   FILE *f=popen(cmd,"r");if(f){char line[256];while(fgets(line,sizeof line,f)){
    if(!strncmp(line,"Restart=",8)){sscanf(line+8,"%63s",cache->restart);cache->has_restart=cache->restart[0]!=0;}
    else if(!strncmp(line,"RestartUSec=",12)){
     char *v=line+12,*end;double number=strtod(v,&end);if(end!=v){while(*end==' ')end++;
      if(!strncmp(end,"min",3))number*=60000;else if(!strncmp(end,"ms",2))number*=1;else if(*end=='s'||!strncmp(end,"sec",3))number*=1000;else if(!strncmp(end,"us",2))number/=1000;else if(!strncmp(end,"h",1))number*=3600000;else if(!strncmp(end,"day",3))number*=86400000;
      cache->delay=(int64_t)number;cache->has_delay=true;
     }else cache->has_delay=false;
    }
   }pclose(f);}
  }cache->last_policy_s=now;
 }
 c->has_restart=cache->has_restart;if(c->has_restart)snprintf(c->restart_policy,sizeof c->restart_policy,"%s",cache->restart);
 c->has_restart_delay=cache->has_delay;c->restart_delay_ms=cache->delay;
}
int read_cgroups(Cgroup *cgs,const Process *procs,int n,double now_s){int count=0;policy_budget=0;char path[512],b[8192];
 for(int i=0;i<n;i++){
  int found=-1;for(int j=0;j<count;j++)if(!strcmp(cgs[j].path,procs[i].cgroup)){found=j;break;}if(found>=0)continue;
  if(count>=MAX_CGROUPS)break;
  Cgroup *c=&cgs[count++];memset(c,0,sizeof(*c));snprintf(c->path,sizeof c->path,"%s",procs[i].cgroup);
  const char *last=strrchr(c->path,'/');last=last?last+1:c->path;
  size_t len=strlen(last);if((len>=8&&!strcmp(last+len-8,".service"))||(len>=6&&!strcmp(last+len-6,".scope"))){c->has_unit=true;snprintf(c->unit,sizeof c->unit,"%s",last);}
  make_path(path,sizeof path,c->path,"memory.current");read_int_file(path,&c->mem_current);
  make_path(path,sizeof path,c->path,"memory.max");c->has_mem_max=read_limit(path,&c->mem_max);
  make_path(path,sizeof path,c->path,"memory.high");c->has_mem_high=read_limit(path,&c->mem_high);
  make_path(path,sizeof path,c->path,"memory.swap.current");c->has_swap=read_int_file(path,&c->swap_current)==0;
  make_path(path,sizeof path,c->path,"memory.stat");uint64_t a=0,f=0,ra=0,rf=0,ref=0;bool has_ref=false;
  if(read_text(path,b,sizeof b)>=0){mem_stat(b,"anon",&a);mem_stat(b,"file",&f);bool ha=mem_stat(b,"workingset_refault_anon",&ra);bool hf=mem_stat(b,"workingset_refault_file",&rf);if(ha||hf){ref=ra+rf;has_ref=true;}else has_ref=mem_stat(b,"workingset_refault",&ref);}
  c->anon=(int64_t)a;c->file=(int64_t)f;
  CGCache *cache=NULL;for(int j=0;j<MAX_CGROUPS;j++)if(caches[j].path[0]&&!strcmp(caches[j].path,c->path)){cache=&caches[j];break;}
  if(!cache)for(int j=0;j<MAX_CGROUPS;j++)if(!caches[j].path[0]){cache=&caches[j];snprintf(cache->path,sizeof cache->path,"%s",c->path);break;}
  if(cache&&has_ref){if(cache->valid&&now_s>cache->last_s&&ref>=cache->refault){c->has_refault=true;c->refault_rate=(ref-cache->refault)/(now_s-cache->last_s);}cache->refault=ref;cache->last_s=now_s;cache->valid=true;}
  make_path(path,sizeof path,c->path,"memory.pressure");if(read_text(path,b,sizeof b)>=0)c->has_psi=parse_psi(b,"some",&c->psi_some10)&&parse_psi(b,"full",&c->psi_full10);
  make_path(path,sizeof path,c->path,"memory.oom.group");int64_t flag=0;if(read_int_file(path,&flag)==0)c->oom_group=flag!=0;
  make_path(path,sizeof path,c->path,"cgroup.kill");c->kill_supported=access(path,F_OK)==0;
  make_path(path,sizeof path,c->path,"cgroup.procs");if(read_text(path,b,sizeof b)>=0){for(char *p=b;*p;p++)if(*p=='\n')c->nr_procs++;if(b[0]&&b[strlen(b)-1]!='\n')c->nr_procs++;}
  if(cache)restart_info(c,cache,now_s);
 }
 return count;
}
