#include "include/sensor.h"
#include <dirent.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <ctype.h>
#include <unistd.h>
#include <sys/types.h>
#include <inttypes.h>
#include <errno.h>
static Process all[MAX_PROCESSES];
typedef struct {int pid;uint64_t start;int64_t pss,uss,swap;bool valid;} Cache;
static Cache cache[MAX_PROCESSES];
static int cmp_rss(const void *a,const void *b){const Process *x=a,*y=b;return x->rss<y->rss?1:x->rss>y->rss?-1:0;}
static int cmp_pss(const void *a,const void *b){const Process *x=a,*y=b;return x->pss<y->pss?1:x->pss>y->pss?-1:0;}
static void clean_nul(char *s,int n){for(int i=0;i<n;i++)if(s[i]=='\0')s[i]=' ';while(n>0&&s[n-1]==' ')s[--n]=0;}
static bool parse_stat(Process *p,const char *b){
 const char *l=strchr(b,'('),*r=strrchr(b,')');if(!l||!r||r<l)return false;
 size_t len=(size_t)(r-l-1);if(len>=sizeof p->comm)len=sizeof p->comm-1;
 memcpy(p->comm,l+1,len);p->comm[len]=0;
 char tail[2048];snprintf(tail,sizeof tail,"%s",r+2);
 /* field 3 starts immediately after the closing ')' */
 char *save=NULL,*token=strtok_r(tail," \n",&save);int field=3;
 unsigned long long utime=0,stime=0;
 while(token){switch(field){
 case 3:p->state=token[0];break;
 case 4:p->ppid=atoi(token);break;
 case 9:{unsigned long flags=strtoul(token,NULL,10);if(flags&0x00200000UL)return false;break;}
 case 14:utime=strtoull(token,NULL,10);break;
 case 15:stime=strtoull(token,NULL,10);break;
 case 20:p->threads=atoi(token);break;
 case 22:p->start_ticks=strtoull(token,NULL,10);break;
 }if(field>=22)break;token=strtok_r(NULL," \n",&save);field++;}
 if(field<22||!p->start_ticks)return false;
 p->cpu_ms=(utime+stime)*1000/(uint64_t)ticks_per_second;return true;
}
static void take_smapped(Process *p,Cache *entry){
 char path[96],b[8192];snprintf(path,sizeof path,"/proc/%d/smaps_rollup",p->pid);
 if(read_text(path,b,sizeof b)<0){if(entry&&entry->valid){p->pss=entry->pss;p->uss=entry->uss;p->swap=entry->swap;p->smaps_valid=true;}return;}
 long long pss=-1,pc=-1,pd=-1,sw=0;
 const char *cur=b;
 while(*cur){long long val;char key[64];if(sscanf(cur,"%63[^:]: %lld",key,&val)==2){
 if(!strcmp(key,"Pss"))pss=val;
 else if(!strcmp(key,"Private_Clean"))pc=val;
 else if(!strcmp(key,"Private_Dirty"))pd=val;
 else if(!strcmp(key,"Swap"))sw=val;
 }const char *q=strchr(cur,'\n');if(!q)break;cur=q+1;}
 if(pss<0||pc<0||pd<0)return;
 p->pss=pss*1024;p->uss=(pc+pd)*1024;p->swap=sw*1024;p->smaps_valid=true;
 if(entry){*entry=(Cache){p->pid,p->start_ticks,p->pss,p->uss,p->swap,true};}
}
static void metadata(Process *p){char path[128],b[2048];
 snprintf(path,sizeof path,"/proc/%d/status",p->pid);
 if(read_text(path,b,sizeof b)>=0){const char *q=strstr(b,"\nUid:");if(!q&&strncmp(b,"Uid:",4)==0)q=b; if(q){if(*q=='\n')q++;p->uid=(int)strtoul(q+4,NULL,10);}}
 snprintf(path,sizeof path,"/proc/%d/cmdline",p->pid);int n=read_text(path,b,sizeof b);
 if(n>0){int m=n>128?128:n;memcpy(p->cmdline,b,m);p->cmdline[m]=0;clean_nul(p->cmdline,m);}else p->cmdline[0]=0;
 snprintf(path,sizeof path,"/proc/%d/cgroup",p->pid);
 if(read_text(path,b,sizeof b)>=0){const char *q=strstr(b,"0::");if(q){q+=3;size_t m=strcspn(q,"\r\n");if(m>=sizeof p->cgroup)m=sizeof p->cgroup-1;memcpy(p->cgroup,q,m);p->cgroup[m]=0;}}
 if(!p->cgroup[0])strcpy(p->cgroup,"/");
 int64_t v;snprintf(path,sizeof path,"/proc/%d/oom_score",p->pid);if(read_int_file(path,&v)==0)p->oom_score=(int)v;
 snprintf(path,sizeof path,"/proc/%d/oom_score_adj",p->pid);if(read_int_file(path,&v)==0)p->oom_adj=(int)v;
}
int read_processes(Process *out,int *total,double uptime_s,bool sample_smaps){
 DIR *d=opendir("/proc");if(!d)return -1;struct dirent *de;int n=0;
 while((de=readdir(d))){if(!isdigit((unsigned char)de->d_name[0]))continue;
 bool numeric=true;for(const char *k=de->d_name;*k;k++)if(!isdigit((unsigned char)*k)){numeric=false;break;}if(!numeric)continue;
 if(n>=MAX_PROCESSES){static int warned=0;if(!warned++){fprintf(stderr,"oomsense: process cap reached (%d)\n",MAX_PROCESSES);}break;}
 Process p={0};p.pid=atoi(de->d_name);char path[128],b[4096];
 snprintf(path,sizeof path,"/proc/%d/stat",p.pid);if(read_text(path,b,sizeof b)<0||!parse_stat(&p,b))continue;
 snprintf(path,sizeof path,"/proc/%d/statm",p.pid);if(read_text(path,b,sizeof b)<0)continue;
 unsigned long long size,resident;if(sscanf(b,"%llu %llu",&size,&resident)!=2)continue;(void)size;p.rss=(int64_t)resident*page_size;
 p.pss=p.rss;p.uss=0;p.swap=0;/* Conservative fallback when smaps cannot be read. */
 double age=uptime_s-(double)p.start_ticks/ticks_per_second;p.age_ms=age>0?(uint64_t)(age*1000):0;
 metadata(&p);if(!p.cmdline[0]&&p.ppid==2)continue; /* Kernel workers, extra safeguard */
 all[n++]=p;
 }
 closedir(d);
 for(int i=0;i<n;i++)for(int j=0;j<n;j++)if(all[j].ppid==all[i].pid)all[i].children++;
 qsort(all,n,sizeof(Process),cmp_rss);
 int candidates=n<opts.top?n:opts.top;
 for(int i=0;i<candidates;i++){
  Process *p=&all[i];Cache *slot=NULL,*unused=NULL;
  for(int j=0;j<MAX_PROCESSES;j++){
   if(cache[j].pid==p->pid&&cache[j].start==p->start_ticks){slot=&cache[j];break;}
   if(!unused&&(!cache[j].valid||cache[j].pid==p->pid))unused=&cache[j];
  }
  if(!slot)slot=unused;
  if(!sample_smaps&&slot&&slot->valid&&slot->start==p->start_ticks){p->pss=slot->pss;p->uss=slot->uss;p->swap=slot->swap;p->smaps_valid=true;}
  else take_smapped(p,slot);
 }
 qsort(all,candidates,sizeof(Process),cmp_pss);
 memcpy(out,all,(size_t)candidates*sizeof(Process));*total=n;return candidates;
}
