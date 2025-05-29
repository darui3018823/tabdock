FROM alpine:latest

COPY dist/tabdock_linux_amd64 /usr/local/bin/tabdock

RUN chmod +x /usr/local/bin/tabdock

ENTRYPOINT ["/usr/local/bin/tabdock"]
