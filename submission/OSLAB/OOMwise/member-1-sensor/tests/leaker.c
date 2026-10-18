#define _POSIX_C_SOURCE 200809L
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>
#include <string.h>
#include <time.h>
/* Bounded test workload: touches 20 MiB each second for at most 200 MiB. */
int main(void){const size_t chunk=20UL*1024*1024;void *blocks[10]={0};
 for(int i=0;i<10;i++){
  blocks[i]=malloc(chunk);if(!blocks[i]){perror("malloc");break;}
  for(size_t off=0;off<chunk;off+=4096)((char *)blocks[i])[off]=1;
  fprintf(stderr,"leaker: %d MiB allocated\n",(i+1)*20);
  struct timespec t={1,0};nanosleep(&t,NULL);
 }
 fprintf(stderr,"leaker: holding for 10 seconds\n");sleep(10);
 for(int i=0;i<10;i++)free(blocks[i]);return 0;
}
