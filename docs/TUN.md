# TUN 故障排除指南

本文档帮助你诊断和解决 TUN 开启受限的问题。

## 目录

- [环境检查](#环境检查)
- [常见问题](#常见问题)
- [Docker 部署配置](#docker-部署配置)
- [主机模式配置](#主机模式配置)
- [运行时问题](#运行时问题)

---

## 环境检查

在启用 TUN 之前，系统需要满足以下条件：

### Docker 模式

| 检查项 | 要求 | 说明 |
|--------|------|------|
| `/dev/net/tun` | 必须存在 | 主机需要 TUN 设备节点 |
| 设备映射 | 需要映射到容器 | `--device /dev/net/tun` |
| NET_ADMIN | 需要 capability | `--cap-add NET_ADMIN` 或 `--privileged` |

### 主机模式

| 检查项 | 要求 | 说明 |
|--------|------|------|
| `/dev/net/tun` | 必须存在 | TUN 设备节点 |
| tun 内核模块 | 需要加载 | `modprobe tun` |

---

## 常见问题

### 1. /dev/net/tun 设备不存在

**错误代码**: `TUN_DEVICE_MISSING`

**症状**: 
- TUN 开关无法启用
- 诊断面板显示 `/dev/net/tun: 缺失`

**原因**: 
- tun 内核模块未加载
- 设备节点未创建

**解决方案**:

```bash
# 方法 1: 加载 tun 模块
sudo modprobe tun

# 方法 2: 创建设备节点
sudo mkdir -p /dev/net
sudo mknod /dev/net/tun c 10 200
sudo chmod 666 /dev/net/tun

# 方法 3: 永久加载模块 (重启后生效)
echo "tun" | sudo tee /etc/modules-load.d/tun.conf
```

**验证**:
```bash
ls -la /dev/net/tun
# 应该显示: crw-rw-rw- 1 root root 10, 200 ...
```

---

### 2. Docker 容器未映射 /dev/net/tun

**错误代码**: `DOCKER_DEVICE_NOT_MAPPED`

**症状**:
- Docker 模式下 TUN 无法启用
- 诊断面板显示容器缺少设备映射

**解决方案**:

```bash
# 停止并删除现有容器
docker stop mihomo-webui
docker rm mihomo-webui

# 使用正确的参数重新启动
docker run -d \
  --name mihomo-webui \
  --device /dev/net/tun \
  --cap-add NET_ADMIN \
  -p 9090:9090 \
  your-image:tag

# 或者使用 docker-compose
```

**docker-compose.yml 示例**:
```yaml
version: '3'
services:
  mihomo-webui:
    image: your-image:tag
    devices:
      - /dev/net/tun:/dev/net/tun
    cap_add:
      - NET_ADMIN
    ports:
      - "9090:9090"
```

---

### 3. Docker 容器缺少 NET_ADMIN 权限

**错误代码**: `DOCKER_NET_ADMIN_MISSING`

**症状**:
- TUN 设备映射正确但仍无法启用
- mihomo 日志显示权限错误

**解决方案**:

```bash
# 添加 NET_ADMIN capability
docker run -d \
  --name mihomo-webui \
  --device /dev/net/tun \
  --cap-add NET_ADMIN \
  -p 9090:9090 \
  your-image:tag

# 或者使用特权模式 (不推荐，安全风险较高)
docker run -d \
  --name mihomo-webui \
  --privileged \
  -p 9090:9090 \
  your-image:tag
```

---

### 4. TUN 配置已启用但运行时未激活

**错误代码**: `TUN_RUNTIME_INACTIVE`

**症状**:
- 配置文件中 `tun.enable: true`
- 运行时状态显示 `disabled`
- mihomo 日志可能有错误信息

**可能原因**:
1. mihomo 启动 TUN 失败
2. 配置冲突
3. 端口或地址冲突

**解决方案**:

```bash
# 1. 查看 mihomo 日志
docker logs mihomo-webui --tail 50
# 或主机模式
sudo journalctl -u mihomo -n 50

# 2. 尝试重启服务
docker restart mihomo-webui
# 或主机模式
sudo systemctl restart mihomo

# 3. 检查配置文件
cat /path/to/config.yaml | grep -A 10 "tun:"
```

**常见配置问题**:

```yaml
# 错误示例: 缺少必要字段
tun:
  enable: true

# 正确示例
tun:
  enable: true
  stack: system
  dns-hijack:
    - 0.0.0.0:53
  auto-route: true
  auto-detect-interface: true
```

---

### 5. 无法读取 mihomo 运行时配置

**错误代码**: `RUNTIME_CONFIG_UNAVAILABLE`

**症状**:
- 诊断面板显示运行时配置读取失败
- mihomo API 不可用

**解决方案**:

```bash
# 1. 检查 mihomo 服务状态
docker ps | grep mihomo
# 或主机模式
sudo systemctl status mihomo

# 2. 检查 API 端口
curl http://localhost:9090/configs

# 3. 检查 external-controller 配置
# config.yaml
external-controller: 0.0.0.0:9090
```

---

## Docker 部署配置

### 完整的 Docker 启动命令

```bash
docker run -d \
  --name mihomo-webui \
  --restart unless-stopped \
  --device /dev/net/tun \
  --cap-add NET_ADMIN \
  -v /path/to/config:/app/config \
  -p 9090:9090 \
  ghcr.io/xiaren-zhuxin1/mihomo-webui:latest
```

### docker-compose.yml 完整示例

```yaml
version: '3.8'

services:
  mihomo-webui:
    image: ghcr.io/xiaren-zhuxin1/mihomo-webui:latest
    container_name: mihomo-webui
    restart: unless-stopped
    devices:
      - /dev/net/tun:/dev/net/tun
    cap_add:
      - NET_ADMIN
    volumes:
      - ./config:/app/config
    ports:
      - "9090:9090"
    environment:
      - TZ=Asia/Shanghai
```

### Kubernetes Deployment 示例

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mihomo-webui
spec:
  selector:
    matchLabels:
      app: mihomo-webui
  template:
    metadata:
      labels:
        app: mihomo-webui
    spec:
      containers:
      - name: mihomo-webui
        image: ghcr.io/xiaren-zhuxin1/mihomo-webui:latest
        securityContext:
          capabilities:
            add:
            - NET_ADMIN
        volumeMounts:
        - name: tun-device
          mountPath: /dev/net/tun
        ports:
        - containerPort: 9090
      volumes:
      - name: tun-device
        hostPath:
          path: /dev/net/tun
          type: CharDevice
```

---

## 主机模式配置

### systemd 服务配置

```bash
# /etc/systemd/system/mihomo.service
[Unit]
Description=Mihomo Proxy
After=network.target

[Service]
Type=simple
User=root
ExecStart=/usr/local/bin/mihomo -d /etc/mihomo
Restart=on-failure
RestartSec=5s

[Install]
WantedBy=multi-user.target
```

### 确保 TUN 模块开机加载

```bash
# 创建模块配置
echo "tun" | sudo tee /etc/modules-load.d/tun.conf

# 立即加载
sudo modprobe tun

# 验证
lsmod | grep tun
```

---

## 运行时问题

### Stack 选择建议

| Stack | 适用场景 | 优缺点 |
|-------|----------|--------|
| `system` | Linux 主机 | 性能最好，但依赖系统网络栈 |
| `gvisor` | 容器环境 | 兼容性好，性能略低 |
| `mixed` | 混合场景 | TCP 用 system，UDP 用 gvisor |

### 常见错误信息

| 错误信息 | 原因 | 解决方案 |
|----------|------|----------|
| `device or resource busy` | TUN 设备被占用 | 重启服务 |
| `address already in use` | 端口冲突 | 检查端口占用 |
| `operation not permitted` | 权限不足 | 添加 NET_ADMIN |
| `no such file or directory` | 设备不存在 | 创建 TUN 设备 |

### 调试命令

```bash
# 检查 TUN 设备
ls -la /dev/net/tun
cat /proc/sys/net/ipv4/ip_forward

# 检查网络接口
ip link show
ip tuntap show

# 检查路由表
ip route show

# 检查 iptables
sudo iptables -L -n -v
sudo iptables -t nat -L -n -v

# 实时监控 mihomo 日志
docker logs -f mihomo-webui
# 或
sudo journalctl -u mihomo -f
```

---

## 自动修复功能

WebUI 提供自动修复功能，可以处理以下问题：

| 问题 | 自动修复操作 |
|------|--------------|
| TUN_RUNTIME_INACTIVE | 自动重启 mihomo 服务 |

对于其他问题（如设备缺失、权限不足），需要手动处理。

---

## 获取帮助

如果以上方法都无法解决问题：

1. 收集诊断信息：
   ```bash
   # 导出诊断报告
   curl http://localhost:9090/api/config/tun > tun-diagnostics.json
   
   # 导出 mihomo 日志
   docker logs mihomo-webui --tail 100 > mihomo.log
   ```

2. 提交 Issue：
   - GitHub: https://github.com/xiaren-zhuxin1/mihomo-webui/issues
   - 附上诊断报告和日志（注意脱敏）

3. 检查配置文件：
   ```bash
   # 确认配置格式正确
   cat /path/to/config.yaml
   ```
