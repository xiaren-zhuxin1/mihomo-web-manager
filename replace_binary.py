import paramiko, time

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('10.1.1.66', username='eric', password='123456', timeout=15)

def run(cmd):
    stdin, stdout, stderr = c.exec_command(cmd, timeout=15)
    out = stdout.read()
    if isinstance(out, bytes): out = out.decode('utf-8', errors='replace')
    return out.strip()

def sudo(cmd):
    stdin, stdout, stderr = c.exec_command("echo '123456' | sudo -S bash -c '%s'" % cmd, timeout=30)
    out = stdout.read()
    if isinstance(out, bytes): out = out.decode('utf-8', errors='replace')
    print('> %s' % cmd[:80])

print('=== Stop service ===')
sudo('systemctl stop mihomo-web-manager')
time.sleep(1)

print('=== Replace binary ===')
sudo('cp /tmp/mwm-binary /opt/mihomo-web-manager/mihomo-manager')
sudo('chmod 755 /opt/mihomo-web-manager/mihomo-manager')
sudo('chown eric:eric /opt/mihomo-web-manager/mihomo-manager')

print('=== Verify binary ===')
print(run('ls -la /opt/mihomo-web-manager/mihomo-manager'))

print('=== Start service ===')
sudo('systemctl start mihomo-web-manager')
time.sleep(2)

print('=== Health check ===')
print(run('curl -s http://127.0.0.1:18080/api/health'))

c.close()
print('Done!')
