"""Explicitly requested Wi-Fi-off verification; restores the prior power state."""
import json, pathlib, subprocess, time, datetime, sys
if '--allow-wifi-toggle' not in sys.argv:
    raise SystemExit('Pass --allow-wifi-toggle only when Wi-Fi interruption is authorized.')
root = pathlib.Path(__file__).resolve().parent.parent
interface = 'en0'
def power():
    return subprocess.check_output(['networksetup','-getairportpower',interface],text=True).strip()
before = power()
was_on = before.endswith('On')
record = {'started':datetime.datetime.now(datetime.timezone.utc).isoformat(),'before':before,'tests':[]}
try:
    subprocess.run(['networksetup','-setairportpower',interface,'off'],check=True)
    record['during'] = power()
    if not record['during'].endswith('Off'):
        raise RuntimeError('Wi-Fi did not switch off.')
    deadline=time.monotonic()+50
    for command in [['npm','test'],['node','--import','tsx','scripts/verify-ai.ts'],['npx','--no-install','playwright','test']]:
        remaining=deadline-time.monotonic()
        if remaining<=0: raise TimeoutError('Offline verification exceeded its time limit.')
        result=subprocess.run(command,cwd=root,text=True,capture_output=True,timeout=remaining)
        record['tests'].append({'command':' '.join(command),'exitCode':result.returncode,'output':result.stdout[-4000:],'errors':result.stderr[-1000:]})
        if result.returncode: raise RuntimeError('Offline test failed: '+' '.join(command))
    record['passed']=True
finally:
    if was_on:
        subprocess.run(['networksetup','-setairportpower',interface,'on'],check=True)
    record['after']=power()
    (root/'artifacts').mkdir(exist_ok=True)
    (root/'artifacts'/'offline-verification.json').write_text(json.dumps(record,indent=2))
    print(json.dumps({k:v for k,v in record.items() if k!='tests'},indent=2))
