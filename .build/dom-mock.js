/* jsdom 运行环境补丁
   本环境的 headless Chrome 已失效（任何 URL 都返回 0 字节），改用 jsdom 跑脚本。
   jsdom 没有真实布局与 canvas/SVG 度量，这里补足被测代码会用到的最小接口。
   注意：布局类断言（getBoundingClientRect / elementFromPoint / 像素级墨迹）
   在 jsdom 下无意义，那些断言留在 smoke-test.html 由真实浏览器执行。 */
const path = require('path');

function mockCtx() {
  const noop = () => {};
  return {
    setTransform: noop, clearRect: noop, save: noop, restore: noop,
    beginPath: noop, moveTo: noop, lineTo: noop, stroke: noop, fill: noop,
    arc: noop, closePath: noop, clip: noop, quadraticCurveTo: noop,
    bezierCurveTo: noop, translate: noop, scale: noop, rect: noop,
    measureText: () => ({ width: 10 }),
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
    canvas: { width: 600, height: 600 }
  };
}

/* spoken: 外部传入的数组，speak 时把朗读文本 push 进去，便于断言「读了几次」 */
function makeOpts(spoken) {
  return {
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
    beforeParse(win) {
      win.HTMLCanvasElement.prototype.getContext = () => mockCtx();
      win.SVGElement.prototype.getBBox = () => ({ x: 0, y: 0, width: 100, height: 100 });
      win.SVGElement.prototype.getTotalLength = () => 100;
      win.SVGElement.prototype.getPointAtLength = () => ({ x: 0, y: 0 });
      win.SVGElement.prototype.createSVGPoint = function () {
        const self = this;
        return {
          x: 0, y: 0,
          matrixTransform() { return { x: this.x, y: this.y }; },
          get owner() { return self; }
        };
      };
      win.SpeechSynthesisUtterance = function (t) { this.text = t; };
      win.speechSynthesis = {
        // 记录文本 + 实际用的 lang / voice，用来断言「读的是不是粤语」
        speak(u) {
          spoken.push({
            text: u.text, lang: u.lang,
            voice: u.voice ? (u.voice.name + '/' + u.voice.lang) : null
          });
          // 真实引擎读完会触发 onend；这里也触发，才能验证「先读词再读字」这种连读
          if (u.onend) setTimeout(() => { try { u.onend(); } catch (e) { } }, 0);
        },
        cancel() {},
        // 故意把粤语放在第一个：macOS 上就是这样，之前的代码取「第一个中文语音」就读了粤语
        getVoices() {
          return [
            { lang: 'zh-HK', name: 'Sinji' },
            { lang: 'zh-TW', name: 'Mei-Jia' },
            { lang: 'zh-CN', name: 'Ting-Ting' },
            { lang: 'en-US', name: 'Samantha' },
            { lang: 'en-GB', name: 'Daniel' }
          ];
        },
        set onvoiceschanged(v) {}, get onvoiceschanged() { return null; }
      };
      // jsdom 没有 PointerEvent，用 MouseEvent 顶替（被测代码只取 clientX/clientY）
      if (!win.PointerEvent) win.PointerEvent = win.MouseEvent;
      // 布局兜底：任何元素都返回一个固定矩形，避免计算 NaN
      win.Element.prototype.getBoundingClientRect = function () {
        return { x: 0, y: 0, left: 0, top: 0, right: 600, bottom: 600, width: 600, height: 600 };
      };
    }
  };
}

const ROOT = path.resolve(__dirname, '..');

module.exports = { ROOT, makeOpts, mockCtx };
