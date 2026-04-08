## DELETE BRANCH
```bash
git checkout develop
git pull
git branch -d feature/rama-temporal
git push origin --delete feature/rama-temporal
```


## DEV
```docker compose -f docker-compose.dev.yml up --build
```
## PROD 
```docker compose -f docker-compose.prod.yml --env-file infra/env/.env.prod up -d --build
```
