/**
 * @file GameDataManager.js
 * @description ゲーム全体の永続的な状態（セーブデータ）を一元管理するシングルトンクラス。
 */
import { MEDALS_DATA } from '../data/medals.js';
import { buildPartData } from '../data/partDataUtils.js';
import { PersistenceService } from './PersistenceService.js';

let instance = null;

export class GameDataManager {
    constructor() {
        if (instance) {
            return instance;
        }
        this.persistenceService = new PersistenceService();
        this.gameData = this.persistenceService.load();

        instance = this;
    }

    /**
     * デフォルトデータで上書きする
     */
    reset() {
        this.gameData = this.persistenceService.reset();
    }

    /**
     * 現在のゲームデータを保存する
     */
    save() {
        this.persistenceService.save(this.gameData);
    }
    
    /**
     * 指定されたインデックスのメダロットデータを整形して取得する
     * @param {number} index 
     * @returns {object|null}
     */
    getMedarot(index) {
        if (!this.gameData.playerMedarots[index]) return null;

        const medarotData = this.gameData.playerMedarots[index];
        const assembledParts = {};

        for (const partSlot in medarotData.set.parts) {
            const partId = medarotData.set.parts[partSlot];
            const masterPartData = buildPartData(partId, partSlot);

            assembledParts[partSlot] = {
                id: partId,
                data: masterPartData
            };
        }

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
     * 指定されたスロットの所持パーツ一覧を取得する
     * @param {string} partSlot 
     * @returns {Array}
     */
    getAvailableParts(partSlot) {
        const inventorySlot = this.gameData.playerPartsInventory[partSlot];
        if (!inventorySlot) return [];
        
        return Object.keys(inventorySlot)
            .map(partId => {
                const masterPartData = buildPartData(partId, partSlot);
                if (!masterPartData) return null;
                return { id: partId, ...masterPartData };
            })
            .filter(part => part !== null);
    }

    /**
     * 所持メダル一覧を取得する
     * @returns {Array}
     */
    getAvailableMedals() {
        const inventory = this.gameData.playerMedalsInventory;
        if (!inventory) return [];

        return Object.keys(inventory)
            .map(medalId => MEDALS_DATA[medalId] || null)
            .filter(medal => medal !== null);
    }

    /**
     * メダロットのパーツを変更する
     * @param {number} medarotIndex 
     * @param {string} partSlot 
     * @param {string} newPartId 
     */
    updateMedarotPart(medarotIndex, partSlot, newPartId) {
        if (this.gameData.playerMedarots[medarotIndex]) {
            this.gameData.playerMedarots[medarotIndex].set.parts[partSlot] = newPartId;
        }
    }

    /**
     * メダロットのメダルを変更する
     * @param {number} medarotIndex 
     * @param {string} newMedalId 
     */
    updateMedarotMedal(medarotIndex, newMedalId) {
        if (this.gameData.playerMedarots[medarotIndex]) {
            this.gameData.playerMedarots[medarotIndex].medalId = newMedalId;
        }
    }

    /**
     * マップ上のプレイヤーの状態を更新する
     * @param {object} param0 
     */
    updatePlayerMapState({ x, y, direction }) {
        if (this.gameData && this.gameData.playerPosition) {
            this.gameData.playerPosition.x = x;
            this.gameData.playerPosition.y = y;
            this.gameData.playerPosition.direction = direction;
        }
    }

    /**
     * バトル結果をゲームデータに反映させる
     * @param {object} battleResult 
     */
    applyBattleResult(battleResult) {
        // TODO: Implement battle result application
    }
}
