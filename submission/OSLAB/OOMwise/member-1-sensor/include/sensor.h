#ifndef OOMSENSE_SENSOR_H
#define OOMSENSE_SENSOR_H
#define _GNU_SOURCE
#define _POSIX_C_SOURCE 200809L
#include <stdbool.h>
#include <stdint.h>
#include <stddef.h>
#define MAX_PROCESSES 8192
#define MAX_TOP 256
#define MAX_CGROUPS 256
#define MAX_WINDOW 32
#define MAX_PATH 256
#define JSON_CAP (2*1024*1024)
typedef struct { double some10,some60,full10,full60; uint64_t some_total,full_total; } PSI;
typedef struct {
 int64_t mem_total,mem_available,mem_free,swap_total,swap_free,anon_pages,file_cache,headroom,floor;
 PSI psi; double trend_bps,window_s,time_to_oom; bool trend_valid,time_valid;
} System;
typedef struct {
 int pid,ppid,uid,threads,children,oom_score,oom_adj; char state;
 uint64_t start_ticks,cpu_ms,age_ms; int64_t rss,pss,uss,swap;
 char comm[128],cmdline[129],cgroup[MAX_PATH];
 double rss_trend; bool rss_trend_valid, smaps_valid;
} Process;
typedef struct {
 char path[MAX_PATH],unit[128],restart_policy[64]; bool has_unit,has_restart,kill_supported,oom_group;
 int64_t mem_current,mem_max,mem_high,anon,file,swap_current; bool has_mem_max,has_mem_high,has_swap;
 double psi_some10,psi_full10,refault_rate; bool has_psi,has_refault;
 int64_t restart_delay_ms; bool has_restart_delay; int nr_procs;
} Cgroup;
typedef struct { int interval_ms,top,window,floor_pct; bool once,pretty,verbose; } Options;
extern Options opts;
extern long page_size, ticks_per_second;
extern char warning_permission;
int read_text(const char *path, char *dst, size_t cap);
int read_int_file(const char *path, int64_t *out);
void warn_permission_once(const char *path);
int read_system(System *s);
int read_processes(Process *reported,int *total,double uptime_s,bool sample_smaps);
int read_cgroups(Cgroup *cgs,const Process *procs,int n,double now_s);
void predictor_system(System *sys,double mono_s,bool *warmup);
void predictor_processes(Process *p,int n,double mono_s,bool warmup);
int emit_json(const System *s,const Process *p,int n,int total,const Cgroup *c,int nc,int seq,bool warmup,int64_t ts_ms);
void json_init(void);
void json_reset(void);
void harden(void);
#endif
