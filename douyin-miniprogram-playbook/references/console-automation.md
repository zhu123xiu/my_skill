# 浏览器自动化操作抖音开放平台的坑

> 用浏览器自动化（如 Playwright）操作抖音开放平台控制台时，以下是已知的坑和解决方案。

---

## 1. 使用可见的授权浏览器会话

- 必须使用可见的浏览器会话（非 headless），因为平台有反自动化检测
- 登录态用 `state_save` / `state_load` 持久化，一次扫码后续会话复用
- **不要在 skill 中持久化凭据**——登录态文件可以保存，但密码/验证码绝不保存

---

## 2. Semi Select 下拉选项

- Semi Design 的 Select 下拉选项渲染在 **portal** 中，不在 accessibility tree 里
- 无法用常规的 `getByRole('option')` 定位
- **解决方案**：用 `evaluate` 查询 `[class*=select-option]` 或 `getByText` 文本匹配
- 下拉展开可能遮挡其他元素——操作前先收起其他下拉

---

## 3. Tab 漂移

- 打开多个 tab 时，`evaluate` 可能落在非 navigate 的 tab 上
- **解决方案**：关掉多余的 live tab，只保留目标 tab
- discarded tab 的 refs 全部失效，需要重新快照（`take_snapshot`）

---

## 4. 提交按钮 disabled

- 提交按钮 disabled 通常是**漏勾必选 radio/checkbox**
- 常见遗漏：「站内信通知」必选（否则提交按钮一直 disabled）
- **解决方案**：检查所有必选 radio/checkbox 是否已勾选

---

## 5. React 受控文件上传

- 抖音控制台使用 React 受控组件，直接设置 `<input>` 的 value 不触发 onChange
- **解决方案**：用 `DataTransfer` 构造 File 对象注入，然后手动 dispatch 冒泡的 `change` 事件
- 示例代码模式：
  ```js
  const dt = new DataTransfer();
  dt.items.add(file);
  input.files = dt.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
  ```

---

## 6. iframe 跨域

- 部分页面（如巨量后台）嵌入在 iframe 中，跨域无法直接操作
- **解决方案**：用 `evaluate` 在同域上下文中执行 `fetch` 调用同域接口
- 不要试图跨域访问 iframe 内的 DOM

---

## 7. 停止点（升级到 L3）

以下操作必须停下来让用户本人完成，AI 不代办：

- 扫码登录（QR scan）
- 短信/二次验证（SMS code）
- 人脸识别（face verification）
- 协议签署（agreement signature）
- 缴费（payment）
- 对公打款确认

---

## 8. 其他注意事项

- 页面加载后等待足够时间再操作（React 渲染有延迟）
- 某些按钮需要滚动到可见区域才能点击
- 弹窗/对话框出现时需要先处理才能继续操作
- 网络请求可能较慢，设置合理的超时时间
- 操作完成后截图留证（用于归档到 `~/subject-profile/05-其他平台回执/`）
