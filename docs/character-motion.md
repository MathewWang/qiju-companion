# 桃桃逐帧动作原型

预览入口：`http://127.0.0.1:4326/?motion=1`（需启动本地服务）。按钮支持待机、招手、坐下和站起，以及不调用模型的模拟消息。

动作素材使用内置 image_gen 生成，参考原桃桃立绘，保存至 `public/characters/taotao-motion-v1.png`，原立绘保留。图集为四列三行，第一行待机眨眼，第二行招手，第三行坐下；站起反向播放第三行。桃桃和小白均已制作独立图集，缩略头像仍使用原图；预览页支持角色切换，`?motion=1&character=xiaobai` 可直接预览小白。

桌面桃桃收到新的助理消息时招手一次；一轮招手中到来的消息合并。无交互三分钟后坐下，点击或键盘交互唤起；助理休息状态也进入坐姿。页面隐藏时暂停逐帧计时，减少动作偏好下显示静止姿态。素材加载失败时回退原立绘。

这是 12 格动作方向原型，生成帧仍存在轮廓、衣服细节和位置轻微变化；坐下的第一格已经弯膝，动作衔接尚不如人工逐帧或骨骼动画。未进行拆图骨骼绑定。后续可补中间帧与更细腻的表情。

## 最终生成提示词（内置工具模式）

Use case: identity-preserve. Asset: production transparent PNG animation SPRITE SHEET for a desktop companion, based on the referenced woman. Preserve her long wavy dark hair, gold eyes, black gold embroidered long dress, gold earrings, black ankle boots, mature gentle anime illustration identity. Create ONE perfectly regular 4 columns by 3 rows contact sheet, ideally 2048x1536 (each cell square). Exactly 12 full-body sprites, no text, no labels, no grid lines, NO background glow or shadows beyond character, genuinely transparent background. Identical camera, proportions, scale and x center in every cell, feet ground line at 94% of each cell; head of standing figure at 8%, entire hands and dress within cell. Columns show consecutive animation frames left to right. ROW 1: neutral standing arms relaxed at sides; second eyes half closed; third eyes closed gentle blink; fourth open again. ROW 2: standing friendly waving at viewer, raised right forearm: four frames hand tilts left, center, right, center; shoulders and feet steady, gentle warm smile. ROW 3: four successive sit-down frames: knees slightly bend, lowering halfway, almost seated, fully seated upright on a simple small dark stool with knees together and hands resting on lap. Standing feet baseline maintained, seated head naturally lower, do NOT zoom seated person. Stool only visible in row3. This is a real sprite sheet intended for CSS background-position stepped animation, strict equal cell registration is essential. No extra figures outside cells, no cropping, no decorative panels.
