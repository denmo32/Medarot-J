/**
 * @file カスタマイズ画面：ロジックシステム
 * UIから発行されたイベントに基づき、実際のゲームデータ（パーツの装備など）を
 * 更新するビジネスロジックを実行する責務を持ちます。
 */
import { BaseSystem } from '../../core/baseSystem.js';
import { GameDataManager } from '../../core/GameDataManager.js';

export class CustomizeLogicSystem extends BaseSystem {
    constructor(world) {
        super(world);
        this.dataManager = new GameDataManager();

        this.world.on('EQUIP_PART_REQUESTED', this.onEquipPartRequested.bind(this));
        // メダル装備要求イベントを購読
        this.world.on('EQUIP_MEDAL_REQUESTED', this.onEquipMedalRequested.bind(this));
    }

    /**
     * パーツ装備要求イベントのハンドラ
     * @param {object} detail - イベントペイロード { medarotIndex, partSlot, newPartId }
     */
    onEquipPartRequested(detail) {
        const { medarotIndex, partSlot, newPartId } = detail;
        this.equipPart(medarotIndex, partSlot, newPartId);
    }

    /**
     * メダル装備要求イベントのハンドラ
     * @param {object} detail - イベントペイロード { medarotIndex, newMedalId }
     */
    onEquipMedalRequested(detail) {
        const { medarotIndex, newMedalId } = detail;
        this.equipMedal(medarotIndex, newMedalId);
    }

    /**
     * 選択したパーツをメダロットに装備させる。
     * @param {number} medarotIndex - 更新するメダロットのインデックス
     * @param {string} partSlot - 更新するパーツのスロット
     * @param {string} newPartId - 新しいパーツのID
     */
    equipPart(medarotIndex, partSlot, newPartId) {
        if (!newPartId) return;

        this.dataManager.updateMedarotPart(medarotIndex, partSlot, newPartId);

        // 装備完了をUIシステムに通知し、再描画をトリガーさせる
        this.world.emit('PART_EQUIPPED');
    }

    /**
     * 選択したメダルをメダロットに装備させる。
     * @param {number} medarotIndex - 更新するメダロットのインデックス
     * @param {string} newMedalId - 新しいメダルのID
     */
    equipMedal(medarotIndex, newMedalId) {
        if (!newMedalId) return;

        this.dataManager.updateMedarotMedal(medarotIndex, newMedalId);

        // 装備完了をUIシステムに通知し、再描画をトリガーさせる
        this.world.emit('MEDAL_EQUIPPED');
    }

    update(deltaTime) {
        // イベント駆動のためupdate処理は不要
    }
}