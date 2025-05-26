# 基础镜像
FROM node:18

# 创建工作目录
WORKDIR /app

# 拷贝项目文件
COPY . .

# 安装依赖
RUN npm install

# 创建图片上传目录
RUN mkdir -p public/uploads

# 暴露端口
EXPOSE 3000

# 启动应用
CMD ["node", "server.js"]
