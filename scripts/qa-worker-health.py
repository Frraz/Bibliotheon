#!/usr/bin/env python3
"""Exercise current mounted health CLI in a disposable container, never certify the old image."""
from pathlib import Path
from datetime import datetime, timezone
import hashlib
import json
import os
import subprocess

ROOT = Path(__file__).resolve().parents[1]
assert os.environ.get('BIBLIOTHEON_SYNTHETIC_TESTS') == 'true', 'Somente ambiente sintético.'
image = os.environ.get('BIBLIOTHEON_HEALTH_TEST_IMAGE', 'bibliotheon:local-d107')
subprocess.run(['node', 'scripts/build-runtime.mjs'], cwd=ROOT, check=True)
image_id = subprocess.check_output(['docker', 'image', 'inspect', image, '--format', '{{.Id}}'], text=True).strip()
probe = r"""
const fs=require('fs'),{spawnSync}=require('child_process');
const checks=[];
function health(label,enabled,record,expected){
 fs.writeFileSync('/tmp/bibliotheon-worker-health',String(Date.now()),{mode:0o600});
 if(record===undefined){try{fs.unlinkSync('/tmp/bibliotheon-retention-health')}catch{}}
 else fs.writeFileSync('/tmp/bibliotheon-retention-health',typeof record==='string'?record:JSON.stringify(record),{mode:0o600});
 const result=spawnSync(process.execPath,['/app/cli/worker-health.js'],{env:{...process.env,DATA_RETENTION_ENABLED:String(enabled)},encoding:'utf8',timeout:10000});
 if(result.status!==expected)throw Error('Health divergente: '+label);
 checks.push({scenario:label,exitCode:result.status});
}
health('retention disabled',false,undefined,0);
health('missing success',true,undefined,1);
health('fresh complete cycle',true,{version:2,completedAt:Date.now(),overdueSubscriptions:0,activeMarketingReviews:0},0);
health('overdue exceptions',true,{version:2,completedAt:Date.now(),overdueSubscriptions:1,activeMarketingReviews:0},1);
health('active marketing review due',true,{version:2,completedAt:Date.now(),overdueSubscriptions:0,activeMarketingReviews:1},1);
health('stale success',true,{version:2,completedAt:Date.now()-25*3600000-1000,overdueSubscriptions:0,activeMarketingReviews:0},1);
health('future success',true,{version:2,completedAt:Date.now()+60000,overdueSubscriptions:0,activeMarketingReviews:0},1);
health('corrupt success',true,'{',1);
const worker=spawnSync(process.execPath,['/app/cli/worker.js','--once'],{env:{...process.env,PAYLOAD_SECRET:'synthetic-health-only-'.padEnd(48,'x'),DATABASE_URL:'postgresql://synthetic:synthetic@127.0.0.1:5432/synthetic',LEAD_TOKEN_SECRET:'short',DATA_RETENTION_ENABLED:'true'},encoding:'utf8',timeout:15000});
if(worker.status===0||!worker.stderr.includes('Retenção automática exige'))throw Error('Chave ausente não foi recusada antes de abrir o banco.');
checks.push({scenario:'retention worker refuses invalid link key before database startup',exitCode:worker.status});
console.log(JSON.stringify({checks,nodeVersion:process.version}));
"""
command = ['docker', 'run', '--rm', '--network', 'none', '--read-only', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges:true', '--tmpfs', '/tmp:size=32m,mode=1777']
for name in ['worker-health', 'worker']:
    command += ['--mount', f'type=bind,src={ROOT / ".release" / (name + ".js")},dst=/app/cli/{name}.js,readonly']
command += ['--entrypoint', 'node', image_id, '-e', probe]
result = subprocess.run(command, capture_output=True, text=True, timeout=90)
if result.returncode:
    raise RuntimeError('Falha no ensaio isolado das CLIs de saúde; nenhuma saída privada publicada.')
evidence = {'phase': 'D113', 'date': datetime.now(timezone.utc).isoformat(), 'runtime': json.loads(result.stdout), 'runtimeBaseImageID': image_id, 'currentCLIsMountedReadOnly': True, 'networkDisabled': True, 'fullApplicationImageValidated': False, 'productionChanged': False, 'sourceSHA256': {name: hashlib.sha256((ROOT / name).read_bytes()).hexdigest() for name in ['scripts/qa-worker-health.py', 'scripts/worker-health.ts', 'scripts/worker.ts', 'src/modules/marketing/retention-policy.ts', '.release/worker-health.js', '.release/worker.js']}}
output = ROOT / 'artifacts/worker-health/d113-results.json'
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(json.dumps(evidence, ensure_ascii=False, indent=2) + '\n')
print('Saúde do worker: oito cenários das CLIs atuais aprovados, sem rede e sem banco.')
