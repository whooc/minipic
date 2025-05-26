const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const multer = require('multer');
const fs = require('fs-extra');
const path = require('path');

const app = express();
const PORT = 3000;

// Session 配置
app.use(session({
  secret: 'super_secret_key',
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 } // 7天
}));

// 解析表单
app.use(express.urlencoded({ extended: true }));

// 设置静态文件路径
app.use(express.static(path.join(__dirname, 'public')));

// 设置 EJS 模板引擎
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// 加载用户数据
let USERS = {};
try {
  USERS = JSON.parse(fs.readFileSync('./users.json', 'utf-8'));
} catch {
  USERS = {};
  console.warn("⚠️ 未检测到 users.json，登录将失败");
}

// 登录保护中间件
function auth(req, res, next) {
  if (req.session.loggedIn) return next();
  res.redirect('/login');
}

// 登录页面
app.get('/login', (req, res) => {
  res.render('login', { error: null });
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (USERS[username] && await bcrypt.compare(password, USERS[username])) {
    req.session.loggedIn = true;
    res.redirect('/');
  } else {
    res.render('login', { error: '用户名或密码错误' });
  }
});

// 登出
app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

// 上传页面
app.get('/', auth, async (req, res) => {
  const files = (await fs.readdir('./public/uploads'))
    .map(name => ({
      name,
      time: fs.statSync(path.join('./public/uploads', name)).mtimeMs
    }))
    .sort((a, b) => b.time - a.time)
    .map(f => f.name);

  const page = parseInt(req.query.page || '1');
  const perPage = parseInt(req.query.perPage || '10');
  const total = files.length;
  const totalPages = Math.ceil(total / perPage);
  const start = (page - 1) * perPage;
  const paginatedFiles = files.slice(start, start + perPage);

  res.render('upload', {
    files: paginatedFiles,
    page, totalPages, perPage
  });
});

// 上传图片配置
const storage = multer.diskStorage({
  destination: './public/uploads/',
  filename: (_, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = Date.now() + '-' + Math.random().toString(36).substring(2, 8) + ext;
    cb(null, name);
  }
});
const upload = multer({ storage });
const formParser = multer(); // 用于解析删除请求（formData）

// 上传处理
app.post('/upload', auth, upload.single('image'), (req, res) => {
  res.redirect('/');
});

// 删除图片处理
app.post('/delete', auth, formParser.none(), async (req, res) => {
  const file = req.body.filename;
  if (!file) return res.status(400).send("无效请求：缺少文件名");

  const filePath = path.join(__dirname, 'public/uploads', file);
  try {
    if (await fs.pathExists(filePath)) await fs.unlink(filePath);
  } catch (err) {
    console.error("❌ 删除失败:", err.message);
  }
  res.sendStatus(200);
});

// 修改账号密码
app.get('/account', auth, (req, res) => {
  res.render('account', { message: null });
});

app.post('/account', auth, async (req, res) => {
  const { currentUsername, currentPassword, newUsername, newPassword } = req.body;

  const userExists = USERS[currentUsername];
  const passwordCorrect = userExists && await bcrypt.compare(currentPassword, USERS[currentUsername]);

  if (!userExists || !passwordCorrect) {
    return res.render('account', { message: '当前用户名或密码错误' });
  }

  const finalUsername = newUsername || currentUsername;
  const finalPassword = newPassword || currentPassword;
  const hashed = await bcrypt.hash(finalPassword, 10);

  const updatedUsers = { ...USERS };
  delete updatedUsers[currentUsername];
  updatedUsers[finalUsername] = hashed;

  await fs.writeFile('./users.json', JSON.stringify(updatedUsers, null, 2));
  USERS = updatedUsers;

  req.session.destroy(() => {
    res.render('login', { error: '账号已更新，请重新登录' });
  });
});

// 启动服务
app.listen(PORT, () => {
  console.log(`✅ 图床服务运行于 http://localhost:${PORT}`);
});
