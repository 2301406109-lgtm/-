const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const SerialPort = require('serialport');
const Readline = require('@serialport/parser-readline');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

// 静态文件服务
app.use(express.static(__dirname));

// 串口配置
let port;
let parser;
let isConnected = false;

// 尝试连接串口
function connectSerialPort() {
    // 这里需要根据实际情况修改串口名称
    // Windows通常是COM3, COM4等
    // Linux通常是/dev/ttyUSB0等
    port = new SerialPort('COM3', {
        baudRate: 9600,
        autoOpen: false
    });
    
    port.open((err) => {
        if (err) {
            console.error('无法打开串口:', err.message);
            isConnected = false;
        } else {
            console.log('串口已连接');
            isConnected = true;
            parser = port.pipe(new Readline({ delimiter: '\n' }));
            
            // 监听串口数据
            parser.on('data', (data) => {
                console.log('收到串口数据:', data);
                // 广播数据给所有客户端
                io.emit('sensorData', { data: data.trim() });
            });
        }
    });
    
    port.on('error', (err) => {
        console.error('串口错误:', err.message);
        isConnected = false;
    });
    
    port.on('close', () => {
        console.log('串口已关闭');
        isConnected = false;
    });
}

// 连接串口
connectSerialPort();

// WebSocket连接处理
io.on('connection', (socket) => {
    console.log('新客户端连接');
    
    // 发送连接状态
    socket.emit('connectionStatus', { connected: isConnected });
    
    // 处理LED控制
    socket.on('controlLED', (data) => {
        console.log('控制LED:', data);
        if (isConnected) {
            port.write(`LED:${data}\n`);
        }
    });
    
    // 处理电机控制
    socket.on('controlMotor', (data) => {
        console.log('控制电机:', data);
        if (isConnected) {
            port.write(`MOTOR:${data}\n`);
        }
    });
    
    // 处理PWM控制
    socket.on('controlPWM', (data) => {
        console.log('控制PWM:', data);
        if (isConnected) {
            port.write(`PWM:${data}\n`);
        }
    });
    
    // 客户端断开连接
    socket.on('disconnect', () => {
        console.log('客户端断开连接');
    });
});

// 重启串口连接
app.get('/api/restart-serial', (req, res) => {
    if (port) {
        port.close(() => {
            setTimeout(connectSerialPort, 1000);
            res.json({ success: true, message: '正在重启串口连接' });
        });
    } else {
        connectSerialPort();
        res.json({ success: true, message: '正在连接串口' });
    }
});

// 获取串口状态
app.get('/api/serial-status', (req, res) => {
    res.json({ connected: isConnected });
});

// 启动服务器
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
});