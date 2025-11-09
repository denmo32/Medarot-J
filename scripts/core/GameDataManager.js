/**
 * @file GameDataManager.js
 * @description ゲーム全体の永続的な状態（セーブデータ）を一元管理するシングルトンクラス。
 * このクラスは、プレイヤーの所持品、メダロット、マップ上の位置など、
 * シーンをまたいで維持されるべきデータを保持し、セーブ・ロード機能を提供します。
 */

import { MEDAROT_SETS } from '../battle/data/medarotSets.js';
import { PARTS_DATA } from '../battle/data/parts.js';
// メダルマスターデータをインポート
import { MEDALS_DATA } from '../battle/data/medals.js';
import { PartInfo } from '../battle/common/constants.js';
import { CONFIG as MAP_CONFIG } from '../map/constants.js';

// デフォルトのプレイヤー初期位置
const initialPlayerPosition = {
    x: 1 * MAP_CONFIG.TILE_SIZE + (MAP_CONFIG.TILE_SIZE - MAP_CONFIG.PLAYER_SIZE) / 2,
    y: 1 * MAP_CONFIG.TILE_SIZE + (MAP_CONFIG.TILE_SIZE - MAP_CONFIG.PLAYER_SIZE) / 2,
    mapName: 'map.json'
};

// デフォルトのプレイヤー所持メダロットデータに `medalId` を追加
const defaultPlayerMedarots = [
    {
        id: 'player_medarot_1',
        name: 'サイカチス',
        medalId: 'kabuto', // 装備メダルID
        set: MEDAROT_SETS[0]
    },
    {
        id: 'player_medarot_2',
        name: 'ロクショウ',
        medalId: 'kuwagata', // 装備メダルID
        set: MEDAROT_SETS[1]
    },
    {
        id: 'player_medarot_3',
        name: 'ドークス',
        medalId: 'bear', // 装備メダルID
        set: MEDAROT_SETS[3]
    }
];

let instance = null;

export class GameDataManager {
    /**
     * GameDataManagerはシングルトンとして実装されます。
     * new GameDataManager() を複数回呼び出しても、常に同じインスタンスが返されます。
     */
    constructor() {
        if (instance) {
            return instance;
        }
        this.gameData = null;
        this.loadGame(); // 起動時に自動でセーブデータを読み込む

        instance = this;
    }

    /**
     * ゲームデータを初期状態にリセットします。
     */
    resetToDefault() {
        const medarots = JSON.parse(JSON.stringify(defaultPlayerMedarots));

        // インベントリには変動データ（個数）のみを保存する
        // これにより、マスターデータ（PARTS_DATA）の変更がセーブデータに自動的に反映されるようになります。
        const inventory = {};
        for (const partType in PARTS_DATA) {
            inventory[partType] = {};
            for (const partId in PARTS_DATA[partType]) {
                inventory[partType][partId] = { count: 1 };
            }
        }

        // メダルインベントリも同様に、変動データのみを保存する
        const medalsInventory = {};
        for (const medalId in MEDALS_DATA) {
            medalsInventory[medalId] = { count: 1 };
        }

        this.gameData = {
            playerPosition: { ...initialPlayerPosition },
            playerMedarots: medarots,
            playerPartsInventory: inventory,
            playerMedalsInventory: medalsInventory, // ★更新: 新しいインベントリ構造
        };
        console.log('Game data has been reset to default.');
    }

    /**
     * localStorageからゲームデータを読み込みます。データがない場合はデフォルト値を設定します。
     */
    loadGame() {
        try {
            const savedData = localStorage.getItem('medarotJSaveData');
            if (savedData) {
                this.gameData = JSON.parse(savedData);
                console.log('Game data loaded from localStorage.', this.gameData);

                // --- 古いセーブデータとの互換性維持 ---
                let needsSave = false;
                
                // パーツインベントリの互換性チェック
                if (this.gameData.playerPartsInventory?.head?.head_001?.name) { // 古い形式（性能データを含む）かチェック
                    console.log('Old save data detected. Upgrading parts inventory.');
                    const newInventory = {};
                    for (const partType in PARTS_DATA) {
                        newInventory[partType] = {};
                        for (const partId in PARTS_DATA[partType]) {
                            // 所持しているという事実だけを引き継ぐ
                            if (this.gameData.playerPartsInventory[partType]?.[partId]) {
                                newInventory[partType][partId] = { count: 1 };
                            }
                        }
                    }
                    this.gameData.playerPartsInventory = newInventory;
                    needsSave = true;
                }
                
                // メダルインベントリの互換性チェック
                if (!this.gameData.playerMedalsInventory || !this.gameData.playerMedalsInventory.kabuto?.count) { // 新しい形式でない場合
                    console.log('Old save data detected. Upgrading medals inventory.');
                    const newMedalsInventory = {};
                    for (const medalId in MEDALS_DATA) {
                        newMedalsInventory[medalId] = { count: 1 };
                    }
                    this.gameData.playerMedalsInventory = newMedalsInventory;
                    needsSave = true;
                }

                // 装備メダルの互換性
                this.gameData.playerMedarots.forEach((medarot, index) => {
                    if (!medarot.medalId) {
                        medarot.medalId = defaultPlayerMedarots[index]?.medalId || Object.keys(MEDALS_DATA)[0];
                        needsSave = true;
                    }
                });

                // セーブデータのメダロットが3機未満の場合、デフォルトデータで補う
                if (!this.gameData.playerMedarots || this.gameData.playerMedarots.length < 3) {
                    console.log('Incomplete medarot data. Completing with default medarots.');
                    const existingIds = new Set(this.gameData.playerMedarots.map(m => m.id));
                    const medarotsToAppend = defaultPlayerMedarots.filter(m => !existingIds.has(m.id));
                    this.gameData.playerMedarots.push(...medarotsToAppend.slice(0, 3 - this.gameData.playerMedarots.length));
                    needsSave = true;
                }

                if (needsSave) this.saveGame(); // データを更新・補完した場合は保存

            } else {
                console.log('No save data found. Initializing with default data.');
                this.resetToDefault();
            }
        } catch (error) {
            console.error('Failed to load game data. Resetting to default.', error);
            this.resetToDefault();
        }
    }

    /**
     * 現在のゲームデータをlocalStorageに保存します。
     */
    saveGame() {
        try {
            localStorage.setItem('medarotJSaveData', JSON.stringify(this.gameData));
            console.log('Game data saved successfully.', this.gameData);
        } catch (error) {
            console.error('Failed to save game data.', error);
        }
    }

    /**
     * マップモードで必要となるプレイヤーのデータを取得します。
     * @returns {{position: {x: number, y: number, mapName: string}}}
     */
    getPlayerDataForMap() {
        return {
            position: this.gameData.playerPosition
        };
    }

    /**
     * バトルモードで必要となるプレイヤーのチーム構成を取得します。
     * @returns {Array<Object>} プレイヤーチームのメダロット構成の配列
     */
    getPlayerDataForBattle() {
        // プレイヤーが所持するメダロットのデータに `medalId` を含める
        return this.gameData.playerMedarots.map(medarot => {
            // この関数はパーツIDのセットを返す役割のため、ロジックは変更しない。
            // パーツの性能データは戦闘シーンの`entityFactory`でマスターデータから読み込まれる。
            return {
                name: medarot.name,
                medalId: medarot.medalId, // 装備中のメダルID
                set: {
                    name: medarot.set.name,
                    parts: medarot.set.parts
                }
            };
        });
    }

    /**
     * 指定したインデックスのメダロットの現在のパーツ構成（IDと詳細データ）を取得します。
     * マスターデータとプレイヤーデータを実行時にマージして返す形式に変更。
     * @param {number} index - メダロットのインデックス (0-2)
     * @returns {object | null} メダロットのデータ、またはnull
     */
    getMedarot(index) {
        if (!this.gameData.playerMedarots[index]) return null;

        const medarotData = this.gameData.playerMedarots[index];
        const assembledParts = {};

        for (const partSlot in medarotData.set.parts) {
            const partId = medarotData.set.parts[partSlot];
            // マスターデータから静的な性能データを取得
            const masterPartData = PARTS_DATA[partSlot]?.[partId] || null;

            assembledParts[partSlot] = {
                id: partId,
                // マスターデータそのものを返す（インベントリに個数以外のデータが増えたらここでマージする）
                data: masterPartData
            };
        }

        // 装備中のメダル情報をマスターデータから取得
        const equippedMedalId = medarotData.medalId;
        const equippedMedalData = MEDALS_DATA[equippedMedalId] || null;

        return {
            name: medarotData.name,
            parts: assembledParts,
            medal: {
                id: equippedMedalId,
                data: equippedMedalData
            }
        };
    }

    /**
     * 指定されたパーツスロットで利用可能な（所持している）パーツのリストを取得します。
     * インベントリ内のIDを元に、マスターデータから完全なパーツデータを構築して返す。
     * @param {string} partSlot - パーツのスロット (e.g., 'head', 'rightArm')
     * @returns {Array<object>} 利用可能なパーツの配列
     */
    getAvailableParts(partSlot) {
        const inventorySlot = this.gameData.playerPartsInventory[partSlot];
        if (!inventorySlot) return [];
        
        return Object.keys(inventorySlot)
            .map(partId => {
                const masterPartData = PARTS_DATA[partSlot]?.[partId];
                if (!masterPartData) return null;
                // IDを付与して返す
                return { id: partId, ...masterPartData };
            })
            .filter(part => part !== null);
    }

    /**
     * 利用可能な（所持している）メダルのリストを取得します。
     * インベントリ内のIDを元に、マスターデータから完全なメダルデータを構築して返す。
     * @returns {Array<object>} 利用可能なメダルの配列
     */
    getAvailableMedals() {
        const inventory = this.gameData.playerMedalsInventory;
        if (!inventory) return [];

        return Object.keys(inventory)
            .map(medalId => MEDALS_DATA[medalId] || null)
            .filter(medal => medal !== null);
    }

    /**
     * 指定されたメダロットのパーツを更新します。
     * @param {number} medarotIndex - 更新するメダロットのインデックス
     * @param {string} partSlot - 更新するパーツのスロット
     * @param {string} newPartId - 新しいパーツのID
     */
    updateMedarotPart(medarotIndex, partSlot, newPartId) {
        if (this.gameData.playerMedarots[medarotIndex]) {
            this.gameData.playerMedarots[medarotIndex].set.parts[partSlot] = newPartId;
            console.log(`Updated Medarot #${medarotIndex} ${partSlot} to ${newPartId}`);
        }
    }

    /**
     * 指定されたメダロットのメダルを更新します。
     * @param {number} medarotIndex - 更新するメダロットのインデックス
     * @param {string} newMedalId - 新しいメダルのID
     */
    updateMedarotMedal(medarotIndex, newMedalId) {
        if (this.gameData.playerMedarots[medarotIndex]) {
            this.gameData.playerMedarots[medarotIndex].medalId = newMedalId;
            console.log(`Updated Medarot #${medarotIndex} medal to ${newMedalId}`);
        }
    }


    /**
     * プレイヤーのマップ上の位置を更新します。
     * @param {number} x - 新しいX座標
     * @param {number} y - 新しいY座標
     */
    updatePlayerPosition(x, y) {
        if (this.gameData && this.gameData.playerPosition) {
            this.gameData.playerPosition.x = x;
            this.gameData.playerPosition.y = y;
        }
    }

    /**
     * バトル終了後の結果をゲームデータに反映します。
     * (このフェーズでは枠組みのみ)
     * @param {object} battleResult - バトルの結果
     */
    applyBattleResult(battleResult) {
        console.log('Applying battle result (not implemented yet):', battleResult);
        // 例:
        // if (battleResult.won) {
        //   this.gameData.money += battleResult.reward;
        // }
    }
}