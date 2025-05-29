FROM alpine:latest
WORKDIR /app

COPY dist/tabdock_linux_amd64 ./tabdock
RUN chmod +x ./tabdock

ENTRYPOINT ["./tabdock"]
