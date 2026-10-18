#include "include/sensor.h"
#include "include/cjson_api.h"
#include <string.h>
#include <stdio.h>
#include <stdint.h>
#include <math.h>
#include <inttypes.h>
#include <stdalign.h>
static alignas(max_align_t) unsigned char arena[3*1024*1024];
static size_t used=0;static char output[JSON_CAP];static int failed=0;
static void *arena_alloc(size_t n){size_t align=alignof(max_align_t);size_t pos=(used+align-1)&~(align-1);if(n>sizeof arena-pos){failed=1;return NULL;}used=pos+n;return arena+pos;}
static void arena_free(void *p){(void)p;}
void json_init(void){cJSON_Hooks h={arena_alloc,arena_free};cJSON_InitHooks(&h);}
void json_reset(void){used=0;failed=0;}
static void put(cJSON *o,const char *k,cJSON *val){if(!o||!val||!cJSON_AddItemToObject(o,k,val))failed=1;}
static void num(cJSON *o,const char *k,double v){if(!isfinite(v))put(o,k,cJSON_CreateNull());else put(o,k,cJSON_CreateNumber(v));}
static void integer(cJSON *o,const char *k,int64_t v){num(o,k,(double)v);}
static void boolean(cJSON *o,const char *k,bool v){put(o,k,cJSON_CreateBool(v));}
static void str(cJSON *o,const char *k,const char *v){put(o,k,cJSON_CreateString(v));}
static void nullable_num(cJSON *o,const char *k,bool known,double v){if(known)num(o,k,v);else put(o,k,cJSON_CreateNull());}
static void nullable_int(cJSON *o,const char *k,bool known,int64_t v){nullable_num(o,k,known,(double)v);}
static void nullable_str(cJSON *o,const char *k,bool known,const char *v){if(known)str(o,k,v);else put(o,k,cJSON_CreateNull());}
static cJSON *system_json(const System *s,bool warmup){cJSON *o=cJSON_CreateObject(),*psi=cJSON_CreateObject();
 integer(o,"mem_total",s->mem_total);integer(o,"mem_available",s->mem_available);integer(o,"mem_free",s->mem_free);
 integer(o,"swap_total",s->swap_total);integer(o,"swap_free",s->swap_free);integer(o,"anon_pages",s->anon_pages);
 integer(o,"file_cache",s->file_cache);integer(o,"headroom_bytes",s->headroom);
 num(psi,"some_avg10",s->psi.some10);num(psi,"some_avg60",s->psi.some60);num(psi,"full_avg10",s->psi.full10);num(psi,"full_avg60",s->psi.full60);
 integer(psi,"some_total_us",s->psi.some_total);integer(psi,"full_total_us",s->psi.full_total);put(o,"psi",psi);
 nullable_num(o,"headroom_trend_bps",!warmup&&s->trend_valid,s->trend_bps);
 nullable_num(o,"trend_window_s",!warmup&&s->trend_valid,s->window_s);
 integer(o,"oom_floor_bytes",s->floor);nullable_num(o,"time_to_oom_s",!warmup&&s->time_valid,s->time_to_oom);
 return o;
}
static cJSON *cg_json(const Cgroup *c){cJSON *o=cJSON_CreateObject();
 str(o,"path",c->path);nullable_str(o,"unit",c->has_unit,c->unit);
 integer(o,"mem_current",c->mem_current);nullable_int(o,"mem_max",c->has_mem_max,c->mem_max);nullable_int(o,"mem_high",c->has_mem_high,c->mem_high);
 integer(o,"anon",c->anon);integer(o,"file",c->file);nullable_int(o,"swap_current",c->has_swap,c->swap_current);
 nullable_num(o,"psi_some_avg10",c->has_psi,c->psi_some10);nullable_num(o,"psi_full_avg10",c->has_psi,c->psi_full10);
 nullable_num(o,"refault_rate_per_s",c->has_refault,c->refault_rate);integer(o,"nr_procs",c->nr_procs);
 boolean(o,"oom_group",c->oom_group);boolean(o,"kill_supported",c->kill_supported);
 nullable_str(o,"restart_policy",c->has_restart,c->restart_policy);nullable_int(o,"restart_delay_ms",c->has_restart_delay,c->restart_delay_ms);
 return o;
}
static cJSON *proc_json(const Process *p,bool warmup){cJSON *o=cJSON_CreateObject();
 integer(o,"pid",p->pid);integer(o,"ppid",p->ppid);integer(o,"start_ticks",p->start_ticks);
 str(o,"comm",p->comm);str(o,"cmdline",p->cmdline);integer(o,"uid",p->uid);str(o,"cgroup",p->cgroup);
 char state[2]={p->state?p->state:'?',0};str(o,"state",state);
 integer(o,"num_threads",p->threads);integer(o,"nr_children",p->children);
 integer(o,"rss",p->rss);integer(o,"pss",p->pss);integer(o,"uss",p->uss);integer(o,"swap",p->swap);
 integer(o,"cpu_time_ms",p->cpu_ms);integer(o,"age_ms",p->age_ms);
 nullable_num(o,"rss_trend_bps",!warmup&&p->rss_trend_valid,p->rss_trend);
 integer(o,"oom_score",p->oom_score);integer(o,"oom_score_adj",p->oom_adj);return o;
}
int emit_json(const System *s,const Process *p,int n,int total,const Cgroup *c,int nc,int seq,bool warmup,int64_t ts_ms){
 json_reset();cJSON *root=cJSON_CreateObject(),*cg=cJSON_CreateArray(),*pr=cJSON_CreateArray();
 integer(root,"schema_version",1);integer(root,"seq",seq);integer(root,"ts_ms",ts_ms);
 integer(root,"interval_ms",opts.interval_ms);boolean(root,"warmup",warmup);put(root,"system",system_json(s,warmup));
 for(int i=0;i<nc;i++)if(!cJSON_AddItemToArray(cg,cg_json(&c[i])))failed=1;
 put(root,"cgroups",cg);integer(root,"processes_total",total);
 for(int i=0;i<n;i++)if(!cJSON_AddItemToArray(pr,proc_json(&p[i],warmup)))failed=1;
 put(root,"processes",pr);
 if(failed||!cJSON_PrintPreallocated(root,output,sizeof output,opts.pretty)){fprintf(stderr,"oomsense: JSON arena or output buffer exhausted\n");return -1;}
 /* In pretty mode one JSON document occupies multiple lines (debug only). */
 if(fputs(output,stdout)==EOF||fputc('\n',stdout)==EOF||fflush(stdout)==EOF)return -1;
 return 0;
}
