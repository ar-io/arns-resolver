# arns-resolver

An Express microservice that provides REST API for mapping ArNS records to their respective Arweave transaction IDs.

## Getting Started

Requirements:

- `nvm`
- `yarn`

### Running Locally

Starting the service:

- `nvm use`
- `cp .env.example .env`
- `yarn start:watch`

You can check the service is running by running the command:

```shell
curl localhost:6000/ar-io/resolver/healthcheck
{"uptime":2.555423702,"date":"2023-09-14T21:24:27.677Z","message":"Welcome to the Permaweb."}
```

### Docker

Build and run the container:

```shell
docker build --build-arg NODE_VERSION=$(cat .nvmrc |cut -c2-8) --build-arg NODE_VERSION_SHORT=$(cat .nvmrc |cut -c2-3) . -t arns-resolver
docker run -p 6000:6000 arns-resolver
```
