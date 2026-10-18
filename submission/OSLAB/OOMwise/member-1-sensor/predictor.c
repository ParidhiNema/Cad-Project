#include "include/sensor.h"
#include <string.h>
#include <math.h>
typedef struct {double t,v;} Sample;
typedef struct {int pid;uint64_t start;unsigned last_seq;int count,next;Sample samples[MAX_WINDOW];} History;
static Sample headroom[MAX_WINDOW];static int head_count=0,head_index=0;
static History history[512];static unsigned seq=0;
static bool slope(const Sample *samples,int n,double *out,double *span){
 if(n<2)return false;
 double t0=samples[0].t,sumx=0,sumy=0,sumxx=0,sumxy=0;
 for(int i=0;i<n;i++){double x=samples[i].t-t0,y=samples[i].v;sumx+=x;sumy+=y;sumxx+=x*x;sumxy+=x*y;}
 double d=n*sumxx-sumx*sumx;if(fabs(d)<1e-12)return false;
 *out=(n*sumxy-sumx*sumy)/d;*span=samples[n-1].t-samples[0].t;return true;
}
void predictor_system(System *sys,double mono_s,bool *warmup){
 headroom[head_index]=(Sample){mono_s,(double)sys->headroom};head_index=(head_index+1)%opts.window;
 if(head_count<opts.window)head_count++;
 *warmup=head_count<opts.window;sys->trend_valid=false;sys->time_valid=false;
 if(*warmup)return;
 Sample ordered[MAX_WINDOW];for(int i=0;i<head_count;i++)ordered[i]=headroom[(head_index+i)%opts.window];
 double v,span;if(!slope(ordered,head_count,&v,&span))return;
 sys->trend_valid=true;sys->trend_bps=v;sys->window_s=span;
 if(v<0){double remaining=((double)sys->headroom-sys->floor)/(-v);sys->time_valid=true;sys->time_to_oom=remaining>0?remaining:0;}
}
void predictor_processes(Process *p,int n,double mono_s,bool warmup){
 seq++;
 for(int i=0;i<n;i++){
  int slot=-1,empty=-1;for(int j=0;j<512;j++){
   if(history[j].pid==p[i].pid&&history[j].start==p[i].start_ticks){slot=j;break;}
   if(empty<0&&(!history[j].pid||history[j].last_seq+2<seq))empty=j;
  }
  if(slot<0){if(empty<0)continue;slot=empty;memset(&history[slot],0,sizeof(history[slot]));history[slot].pid=p[i].pid;history[slot].start=p[i].start_ticks;}
  History *h=&history[slot];h->last_seq=seq;
  h->samples[h->next]=(Sample){mono_s,(double)p[i].rss};
  h->next=(h->next+1)%opts.window;
  if(h->count<opts.window)h->count++;
  p[i].rss_trend_valid=false;
  if(!warmup&&h->count==opts.window){
   Sample ordered[MAX_WINDOW];for(int k=0;k<opts.window;k++)ordered[k]=h->samples[(h->next+k)%opts.window];
   double span;p[i].rss_trend_valid=slope(ordered,opts.window,&p[i].rss_trend,&span);
  }
 }
}
