// scripts/customize/scene.js
// import { GameEvents } from '../battle/common/events.js'; // 削除
// import { GameModeContext } from '../battle/core/index.js'; // 削除

export function setupCustomizeMode(world) {
    // console.log('Function called');
    // console.log('World object received:', world);
    try {
        // GameModeContext.gameMode は変更しない

        // カスタマイズ画面用のUIを表示
        const mapContainer = document.getElementById('map-container');
        const battleContainer = document.getElementById('battle-container');

        // マップとバトルのコンテナを非表示にし、カスタマイズ用のコンテナを表示
        mapContainer.classList.add('hidden');
        battleContainer.classList.add('hidden');

        // カスタマイズ画面用UIの要素を生成・表示（暫定：実装中テキスト）
        let customizeContainer = document.getElementById('customize-container');
        if (!customizeContainer) {
            customizeContainer = document.createElement('div');
            customizeContainer.id = 'customize-container';
            customizeContainer.className = 'customize-container';
            customizeContainer.innerHTML = '<h2>カスタマイズ画面</h2><p>実装中</p>';
            document.body.appendChild(customizeContainer);
        } else {
            customizeContainer.classList.remove('hidden');
        }

        // console.log('Adding keydown listener for customize scene'); // デバッグ用
        // Xキーでマップシーンに戻れるようにするイベントリスナーを追加 (キャプチャフェーズで検知)
        window.addEventListener('keydown', handleEscapeKey, { capture: true });
    } catch (error) {
        console.error('Error in setupCustomizeMode:', error);
    }
}

/**
 * Xキーでマップシーンに戻る処理
 * @param {KeyboardEvent} event
 */
async function handleEscapeKey(event) {
    // console.log('handleEscapeKey called with key:', event.key); // 復活
    if (event.key === 'x' || event.key === 'X') {
        // console.log('X key detected, closing customize scene'); // デバッグ用
        // イベントリスナーを削除
        window.removeEventListener('keydown', handleEscapeKey, { capture: true });
        // イベントリスナーを削除
        window.removeEventListener('keydown', handleEscapeKey);

        // カスタマイズ画面を非表示
        const customizeContainer = document.getElementById('customize-container');
        if (customizeContainer) {
            customizeContainer.classList.add('hidden');
        }

        // マップコンテナを再表示
        const mapContainer = document.getElementById('map-container');
        const battleContainer = document.getElementById('battle-container');
        if (mapContainer) {
            mapContainer.classList.remove('hidden');
        }
        if (battleContainer) {
            // バトルコンテナは、マップモードでは非表示が正しい
            battleContainer.classList.add('hidden');
        }
        // console.log('Customize scene closed, map returned'); // デバッグ用
    }
}