#include "include/sensor.h"
#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include <inttypes.h>
static int64_t kb_field(const char *src,const char *key){
 const size_t len=strlen(key);const char *p=src;
 while(*p){if(!strncmp(p,key,len)&&p[len]==':'){
  unsigned long long v=0;if(sscanf(p+len+1,"%llu",&v)==1)return (int64_t)v*1024;return -1;}
  const char *next=strchr(p,'\n');if(!next)break;p=next+1;
 }return -1;
}
static bool parse_psi_line(const char *b,const char *kind,double *a10,double *a60,uint64_t *total){
 const char *p=b;
 while(*p){if(!strncmp(p,kind,strlen(kind))&&p[strlen(kind)]==' '){
  double a300;unsigned long long t;
  if(sscanf(p+strlen(kind)," avg10=%lf avg60=%lf avg300=%lf total=%llu",a10,a60,&a300,&t)==4){*total=t;return true;}
 }const char *q=strchr(p,'\n');if(!q)break;p=q+1;}return false;
}
int read_system(System *s){char b[8192];memset(s,0,sizeof(*s));
 if(read_text("/proc/meminfo",b,sizeof b)<0)return -1;
 s->mem_total=kb_field(b,"MemTotal");s->mem_available=kb_field(b,"MemAvailable");s->mem_free=kb_field(b,"MemFree");s->swap_total=kb_field(b,"SwapTotal");s->swap_free=kb_field(b,"SwapFree");s->anon_pages=kb_field(b,"AnonPages");s->file_cache=kb_field(b,"Cached");
 if(s->mem_total<0||s->mem_available<0||s->swap_free<0||s->mem_free<0||s->swap_total<0||s->anon_pages<0||s->file_cache<0)return -1;
 s->headroom=s->mem_available+s->swap_free;s->floor=s->mem_total*opts.floor_pct/100;
 const char *psi_path=getenv("OOMSENSE_TEST_PSI_FILE");
 if(read_text(psi_path?psi_path:"/proc/pressure/memory",b,sizeof b)<0){fprintf(stderr,"oomsense: /proc/pressure/memory unavailable; PSI is required by contract\n");return -1;}
 if(!parse_psi_line(b,"some",&s->psi.some10,&s->psi.some60,&s->psi.some_total)||!parse_psi_line(b,"full",&s->psi.full10,&s->psi.full60,&s->psi.full_total))return -1;
 return 0;
}
