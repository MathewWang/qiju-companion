# 桃桃 · 动漫形象 v1

使用内置 imagegen 生成，参考用户提供图片的成熟动漫渲染、黑发、金色眼睛及首饰。作为桌面助理，采用站姿、完整着装和透明背景，不沿用参考图的场景与道具。

素材路径：`public/characters/taotao-anime.png`。

动画方式：PNG 立绘加轻微 CSS 呼吸/摆动；工作状态显示小光点，暂停时降低饱和度。不是 Live2D 骨骼动画，不包含真正的口型/眨眼帧。系统开启减少动态效果时停止动画。

完整生成提示词：

> Create a new original character illustration for a desktop AI assistant named Taotao. Use the attached image ONLY as art-style reference: sophisticated premium anime / manhwa rendering, beautifully shaded long wavy black hair, expressive golden brown eyes, fine gold earrings, elegant mature adult woman (age 28+), warm confident gentle expression. Make a standalone full-body standing character cutout, frontal slight three-quarter turn, head to shoes completely visible, arms relaxed with one hand gently raised in a conversational greeting. Outfit: elegant opaque black midi dress with tasteful gold details and a fitted short black jacket, closed bodice, black ankle boots; refined everyday fashion, natural proportions. No money, no bedroom, no furniture, no lingerie, no text. Clean recognizable silhouette for a 180px tall desktop companion; polished intricate anime facial rendering inspired by reference, not chibi, not photorealistic. Actual transparent alpha background, no backdrop, no shadow rectangle. Single character centered with tight framing, portrait composition. This is a production PNG sprite, not a mockup.

生成参数：`transparent_background: true`；本轮用户参考图作为视觉参考。

背景清理迭代（同样使用内置 imagegen，编辑初稿且保持人物不变）：

> Edit only the background of this character sprite: remove ALL of the dark black/brown background and ALL diffuse glow and ambient gradient around the character. Outside the actual character silhouette the image must be fully transparent alpha=0, not black, not checkerboard, not a glow. Preserve the exact same adult anime woman, face, hairstyle, clothing, pose, shoes and proportions unchanged. Keep crisp natural antialiased edges on hair, clothing and fingers. Full-body transparent PNG cutout, no ground shadow, no backdrop. This is for overlay directly on a user's desktop.

## Liquid Glass 界面

页面 html/body/root 与 Electron 窗口底色显式透明，展开和收起均没有外层白色底板。聊天面板、输入框与按钮使用半透明渐变、内高光、细边线与 backdrop-filter；仅面板占据玻璃材质区域。CSS 模糊作用于网页内的背后内容，不等同于 macOS 原生 Liquid Glass 对桌面像素的折射。`tests/glass.mjs` 验证透明根节点、展开/收起、玻璃样式和输入；截图中的彩色壁纸仅为测试夹具，未加入产品。

后续布局调整：宽屏桌面采用角色在左、面板在右，顺着人物抬手方向展开；窗口展开620×540、收起240×320，保持左侧人物锚点，超出屏幕时约束到工作区。深黑色面板背景 #111318，Liquid 材质仅用于消息气泡、输入框与按钮。窄于600px的浏览器窗口保留上下排布以避免截断。tests/glass.mjs另验证右侧几何关系和面板黑色背景。

动画优化：后续取消展开/收起时的原生窗口 resize，始终使用透明620×540画布（屏幕不足时约束）。人物通过GPU transform在右侧静止位置和左侧聊天位置之间移动380px；聊天面板保持挂载，以transform/opacity同步520ms展开，关闭时inert且不接收点击。没有220ms等待，避免原生窗口重绘与网页动画竞争；透明区继续鼠标穿透，且鼠标穿透IPC只在状态改变时发送。减少动态效果设置下立即切换。浏览器RAF采样确认人物移动与面板淡入同步，约700ms内42帧，最大间隔33ms（测试环境结果，不代表所有机器帧率）。

## 小白系统预制（2026-11-03）
素材：public/characters/xiaobai-anime.png。imagegen reference generation，transparent_background=true，参考用户提供肖像的气质，原创成年动漫助理。1024×1536 PNG，浏览器像素检查约73.8%为完全透明像素。与桃桃一起作为注册选项，Agent仅保存preset skin ID。
生成提示词：
> Use case: stylized-concept. Create an original full-body anime/manhwa character cutout for a desktop personal assistant named Xiaobai. The attached portrait is a reference only for her gentle facial expression, dark loosely tied hair with wispy bangs, pearl earrings and fresh understated grace. Clearly adult woman age 25. Polished premium anime rendering, subtly realistic shading, consistent with a refined desktop anime companion collection. Full head-to-toe standing pose, facing forward slightly three-quarter, warm small smile, right hand slightly lifted toward viewer's right in a welcoming conversational gesture. Outfit: elegant ivory cardigan over a pale blue modest blouse and slate-blue pleated midi skirt, simple cream ankle boots, fine pearl earrings. Natural adult proportions, not chibi, no sexualization. Entire figure including both shoes visible, tight portrait framing and readable silhouette. Only the character; actual transparent alpha background with fully clear pixels outside silhouette, no backdrop, no gradient, no glow, no floor, no frame, no text. PNG production sprite.
