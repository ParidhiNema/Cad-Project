CC ?= gcc
CFLAGS ?= -std=c11 -O2 -Wall -Wextra -Wpedantic
CPPFLAGS ?= -Iinclude
LDFLAGS ?=
LDLIBS ?= -lcjson -lm
SRC := main.c util.c system_collector.c process_collector.c cgroup_collector.c predictor.c json_writer.c
OBJ := $(SRC:.c=.o)
.PHONY: all clean test
all: oomsense
oomsense: $(OBJ)
	$(CC) $(LDFLAGS) -o $@ $(OBJ) $(LDLIBS)
%.o: %.c include/sensor.h
	$(CC) $(CPPFLAGS) $(CFLAGS) -c -o $@ $<
clean:
	rm -f $(OBJ) oomsense
test: oomsense
	bash tests/smoke.sh
