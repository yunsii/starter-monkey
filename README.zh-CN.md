# Starter Monkey

[![repo:github](https://img.shields.io/badge/repo-github-0EA5E9)](https://github.com/yunsii/starter-monkey) [![version](https://img.shields.io/github/v/release/yunsii/starter-monkey?label=version&sort=semver&color=0EA5E9)](https://github.com/yunsii/starter-monkey/releases/latest) [![license](https://img.shields.io/github/license/yunsii/starter-monkey?color=0EA5E9)](https://github.com/yunsii/starter-monkey/blob/master/LICENSE) [![greasyfork](https://img.shields.io/badge/greasyfork-install-0EA5E9)](https://greasyfork.org/scripts/550158-starter-monkey)

适用于 Tampermonkey、Violentmonkey、Greasemonkey、ScriptCat 等 userscript 引擎的起始模板，由 [vite-plugin-monkey](https://github.com/lisonge/vite-plugin-monkey) 强力驱动。

## 安装

可以在 Greasy Fork 上直接安装（点上面的徽章），或者访问：
https://greasyfork.org/scripts/550158-starter-monkey

## 功能

- 🚀 **更顺手的开发体验** - 用统一的规范编码，开发起来更舒服
- ⚡ **React + TailwindCSS** - 快速搭出漂亮的界面
- 🎯 **随意把 UI 放到页面任何地方** - 灵感来自 [wxt](https://github.com/wxt-dev/wxt/blob/ea2b8df906384f3c000ae2ab6ad462e33b79c0f2/packages/wxt/src/utils/content-script-ui/shadow-root.ts)，用起来很方便
- 🔥 **按需智能加载** - 页面不会被污染，只有需要时才加载
- 🎪 **自动匹配规则** - 只要声明一次，剩下的交给它就行
- 📦 **自动发布** - 用 GitHub Actions 自动给版本打包和发布

## 基于此模板的项目

以下是使用 Starter Monkey 模板开发的用户脚本项目：

- **[Bob Monkey](https://github.com/yunsii/bob-monkey)** - 增强 GitHub 和 DeepWiki 使用体验的用户脚本集合，提供页面访问历史记录、问题历史助手、GitHub 一键跳转 DeepWiki 等功能

## 常见问题

- [集成 shadcn/ui 时浮层组件样式丢失](https://github.com/yunsii/starter-monkey/issues/1)
- [想要使用 Ant Design 组件库?](https://github.com/yunsii/bob-monkey/commit/aa4d1316e3a3031768cb82ba19dd579e6e9a20eb)
