#define _POSIX_C_SOURCE 200809L
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>
#include <sys/mman.h>
#include <sys/wait.h>
#include <sys/types.h>
#include <sys/stat.h>
#include <fcntl.h>
#include <string.h>
/* Shared mapped memory: each RSS includes the region, USS remains small. */
int main(void){const size_t size=64UL*1024*1024;
 char key[80];snprintf(key,sizeof key,"/oomsense-decoy-%ld",(long)getpid());
 int fd=shm_open(key,O_CREAT|O_EXCL|O_RDWR,0600);if(fd<0){perror("shm_open");return 1;}
 shm_unlink(key);if(ftruncate(fd,(off_t)size)){perror("ftruncate");return 1;}
 char *map=mmap(NULL,size,PROT_READ|PROT_WRITE,MAP_SHARED,fd,0);close(fd);
 if(map==MAP_FAILED){perror("mmap");return 1;}
 for(size_t i=0;i<size;i+=4096)map[i]=1;
 pid_t pid=fork();if(pid<0){perror("fork");return 1;}
 volatile unsigned long sum=0;for(size_t i=0;i<size;i+=4096)sum+=(unsigned char)map[i];
 fprintf(stderr,"decoy: pid=%ld shared_RSS_region=64MiB\n",(long)getpid());
 sleep(20);if(pid>0)waitpid(pid,NULL,0);munmap(map,size);(void)sum;return 0;
}
