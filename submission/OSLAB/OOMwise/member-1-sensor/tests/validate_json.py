#!/usr/bin/env python3
"""Validate the exact Shared Integration Contract v1 snapshot field structure."""
import json
import sys
TOP = {'schema_version':int,'seq':int,'ts_ms':int,'interval_ms':int,'warmup':bool,'system':dict,'cgroups':list,'processes_total':int,'processes':list}
SYS = {'mem_total':int,'mem_available':int,'mem_free':int,'swap_total':int,'swap_free':int,'anon_pages':int,'file_cache':int,'headroom_bytes':int,'psi':dict,'headroom_trend_bps':(int,float,type(None)),'trend_window_s':(int,float,type(None)),'oom_floor_bytes':int,'time_to_oom_s':(int,float,type(None))}
PSI = {x:(int,float) for x in ('some_avg10','some_avg60','full_avg10','full_avg60')}
PSI.update({'some_total_us':int,'full_total_us':int})
CG = {'path':str,'unit':(str,type(None)),'mem_current':int,'mem_max':(int,type(None)),'mem_high':(int,type(None)),'anon':int,'file':int,'swap_current':(int,type(None)),'psi_some_avg10':(int,float,type(None)),'psi_full_avg10':(int,float,type(None)),'refault_rate_per_s':(int,float,type(None)),'nr_procs':int,'oom_group':bool,'kill_supported':bool,'restart_policy':(str,type(None)),'restart_delay_ms':(int,type(None))}
PROC = {'pid':int,'ppid':int,'start_ticks':int,'comm':str,'cmdline':str,'uid':int,'cgroup':str,'state':str,'num_threads':int,'nr_children':int,'rss':int,'pss':int,'uss':int,'swap':int,'cpu_time_ms':int,'age_ms':int,'rss_trend_bps':(float,int,type(None)),'oom_score':int,'oom_score_adj':int}
def check(obj,schema,label):
    assert isinstance(obj,dict),f'{label}: not an object'
    for key,types in schema.items():
        assert key in obj,f'{label}: missing {key}'
        assert isinstance(obj[key],types),f'{label}.{key}: type {type(obj[key]).__name__}'
def validate(d):
    check(d,TOP,'snapshot');assert d['schema_version']==1
    check(d['system'],SYS,'system');check(d['system']['psi'],PSI,'psi')
    assert d['system']['headroom_bytes']==d['system']['mem_available']+d['system']['swap_free']
    if d['warmup']:
        for k in ('headroom_trend_bps','trend_window_s','time_to_oom_s'):assert d['system'][k] is None
    assert d['processes_total']>=len(d['processes'])
    for i,c in enumerate(d['cgroups']):check(c,CG,f'cgroup[{i}]');assert c['path'].startswith('/')
    for i,p in enumerate(d['processes']):
        check(p,PROC,f'process[{i}]');assert p['cgroup'].startswith('/')
        assert len(p['cmdline'])<=128
        if d['warmup']:assert p['rss_trend_bps'] is None
    assert all(x['pss']>=y['pss'] for x,y in zip(d['processes'],d['processes'][1:]))
if __name__=='__main__':
    n=0
    for line in sys.stdin:
        validate(json.loads(line));n+=1
    assert n,'No JSON lines'
    print(f'PASS: {n} contract v1 snapshots validated',file=sys.stderr)
