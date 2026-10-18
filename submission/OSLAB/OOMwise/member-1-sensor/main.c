#include "include/sensor.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <signal.h>
#include <time.h>
#include <unistd.h>
#include <errno.h>
#include <inttypes.h>
Options opts={500,64,10,3,false,false,false};
long page_size=4096,ticks_per_second=100;
static volatile sig_atomic_t running=1;
static Process reported[MAX_TOP];static Cgroup cgroups[MAX_CGROUPS];
static void stop(int sig){(void)sig;running=0;}
static void usage(FILE *f){fprintf(f,"Usage: oomsense [--once] [--interval-ms N] [--top N] [--window N] [--floor-pct P] [--pretty] [--verbose] [--help]\n  JSON Lines to stdout; diagnostics to stderr. Requires cgroup v2 and PSI.\n");}
static int value(const char *s,int min,int max,int *out){char *end=NULL;errno=0;long v=strtol(s,&end,10);if(errno||end==s||*end||v<min||v>max)return -1;*out=(int)v;return 0;}
static int args(int argc,char **argv){for(int i=1;i<argc;i++){
 if(!strcmp(argv[i],"--help")){usage(stdout);exit(0);}else if(!strcmp(argv[i],"--once"))opts.once=true;
 else if(!strcmp(argv[i],"--pretty"))opts.pretty=true;else if(!strcmp(argv[i],"--verbose"))opts.verbose=true;
 else if(!strcmp(argv[i],"--interval-ms")&&i+1<argc){if(value(argv[++i],100,3600000,&opts.interval_ms))return -1;}
 else if(!strcmp(argv[i],"--top")&&i+1<argc){if(value(argv[++i],1,MAX_TOP,&opts.top))return -1;}
 else if(!strcmp(argv[i],"--window")&&i+1<argc){if(value(argv[++i],2,MAX_WINDOW,&opts.window))return -1;}
 else if(!strcmp(argv[i],"--floor-pct")&&i+1<argc){if(value(argv[++i],0,100,&opts.floor_pct))return -1;}
 else return -1;
 }return 0;}
static double seconds(struct timespec t){return (double)t.tv_sec+(double)t.tv_nsec/1e9;}
static void add_ms(struct timespec *t,int ms){t->tv_sec+=ms/1000;t->tv_nsec+=(long)(ms%1000)*1000000L;if(t->tv_nsec>=1000000000L){t->tv_sec++;t->tv_nsec-=1000000000L;}}
int main(int argc,char **argv){if(args(argc,argv)){usage(stderr);return 2;}
 signal(SIGINT,stop);signal(SIGTERM,stop);signal(SIGPIPE,stop);
 page_size=sysconf(_SC_PAGESIZE);ticks_per_second=sysconf(_SC_CLK_TCK);if(page_size<1||ticks_per_second<1)return 1;
 json_init();harden();struct timespec next,now,wall;clock_gettime(CLOCK_MONOTONIC,&next);int seq=0;
 while(running){clock_gettime(CLOCK_MONOTONIC,&now);double mono=seconds(now);
 char b[128];double uptime=0;if(read_text("/proc/uptime",b,sizeof b)>=0)uptime=strtod(b,NULL);
 System sys;if(read_system(&sys)){fprintf(stderr,"oomsense: cannot read required system memory / PSI\n");return 1;}
 int total=0;int count=read_processes(reported,&total,uptime,seq%2==0);if(count<0){fprintf(stderr,"oomsense: failed to scan /proc\n");return 1;}
 int nc=read_cgroups(cgroups,reported,count,mono);
 bool warmup;predictor_system(&sys,mono,&warmup);predictor_processes(reported,count,mono,warmup);
 clock_gettime(CLOCK_REALTIME,&wall);int64_t ts=(int64_t)wall.tv_sec*1000+wall.tv_nsec/1000000;
 if(emit_json(&sys,reported,count,total,cgroups,nc,++seq,warmup,ts)){if(!running||errno==EPIPE)return 0;return 1;}
 if(opts.verbose){struct timespec finished;clock_gettime(CLOCK_MONOTONIC,&finished);fprintf(stderr,"oomsense: tick=%d processes=%d cgroups=%d elapsed_ms=%.3f\n",seq,count,nc,(seconds(finished)-mono)*1000);}
 if(opts.once)break;
 add_ms(&next,opts.interval_ms);
 while(running){int rc=clock_nanosleep(CLOCK_MONOTONIC,TIMER_ABSTIME,&next,NULL);if(!rc)break;if(rc!=EINTR){fprintf(stderr,"oomsense: clock_nanosleep: %d\n",rc);return 1;}}
 }
 return 0;
}
