$ts = Get-Date -Format "yyyyMMdd_HHmmss"
New-Item -ItemType Directory -Force -Path ".\backups" | Out-Null
docker exec -t erp_db pg_dump -U erp_user -d erp_db | gzip > ".\backups\erp_db_$ts.sql.gz"
Write-Host "Backup creado en backups\erp_db_$ts.sql.gz"
