#ifndef OOMSENSE_CJSON_API_H
#define OOMSENSE_CJSON_API_H
#include <stddef.h>
/* cJSON public API subset. Ubuntu installs the official header via libcjson-dev.
   These declarations support building against an existing runtime in minimal CI. */
#if defined(__has_include)
# if __has_include(<cjson/cJSON.h>)
#  include <cjson/cJSON.h>
#  define OOMSENSE_HAS_CJSON_HEADER 1
# endif
#endif
#ifndef OOMSENSE_HAS_CJSON_HEADER
typedef struct cJSON cJSON;
typedef struct cJSON_Hooks {void *(*malloc_fn)(size_t sz); void (*free_fn)(void *ptr);} cJSON_Hooks;
void cJSON_InitHooks(cJSON_Hooks *hooks);
cJSON *cJSON_CreateObject(void);
cJSON *cJSON_CreateArray(void);
cJSON *cJSON_CreateNull(void);
cJSON *cJSON_CreateBool(int boolean);
cJSON *cJSON_CreateString(const char *string);
cJSON *cJSON_CreateNumber(double num);
int cJSON_AddItemToObject(cJSON *object,const char *string,cJSON *item);
int cJSON_AddItemToArray(cJSON *array,cJSON *item);
int cJSON_PrintPreallocated(cJSON *item,char *buffer,const int length,const int format);
#endif
#endif
