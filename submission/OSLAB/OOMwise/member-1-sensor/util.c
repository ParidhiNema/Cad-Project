#include "include/sensor.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <errno.h>
#include <fcntl.h>
#include <unistd.h>
#include <sys/mman.h>
char warning_permission=0;
int read_text(const char *path,char *dst,size_t cap) {
 if(cap<2)return -1;
 int fd=open(path,O_RDONLY|O_CLOEXEC|O_NONBLOCK);
 if(fd<0){if(errno==EACCES||errno==EPERM)warn_permission_once(path);return -1;}
 ssize_t n=read(fd,dst,cap-1);int err=errno;close(fd);
 if(n<0){errno=err;return -1;}dst[n]=0;return (int)n;
}
int read_int_file(const char *path,int64_t *out){char b[96];if(read_text(path,b,sizeof b)<0)return -1;char *end;errno=0;long long v=strtoll(b,&end,10);if(end==b||errno)return -1;*out=(int64_t)v;return 0;}
void warn_permission_once(const char *p){if(!warning_permission){fprintf(stderr,"oomsense: permission denied for %s (run with sudo for full data)\n",p);warning_permission=1;}}
void harden(void){
 if(mlockall(MCL_CURRENT|MCL_FUTURE)!=0)perror("oomsense: warning: mlockall");
 int fd=open("/proc/self/oom_score_adj",O_WRONLY|O_CLOEXEC);
 if(fd<0||write(fd,"-1000\n",6)!=6)perror("oomsense: warning: oom_score_adj");
 if(fd>=0)close(fd);
}
