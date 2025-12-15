/**
 * @file createBattleMedarotEntity.js
 * @description バトル用のメダロットエンティティを生成する。
 */

// 必要な依存関係をインポート
import * as BattleComponents from '../battle/components/index.js'; // または必要なコンポーネントのみ
import * as CommonComponents from '../components/index.js'; // PlayerInfo, Parts, Medal など
import { MEDALS_DATA } from '../data/medals.js';
import { PARTS_DATA } from '../data/parts.js';
import { buildPartData } from '../data/partDataUtils.js';

/**
 * バトル用メダロットエンティティを作成します。
 * @param {World} world - World インスタンス
 * @param {Object} medarotData - メダロットの初期化データ (name, partsIds, medalId など)
 * @param {Object} initialPosition - 初期位置 {x, y}
 * @param {string} teamId - 所属チームID (例: TeamID.TEAM1)
 * @param {boolean} isLeader - チームリーダーかどうか (省略可能、デフォルト: false)
 * @returns {number} 作成されたエンティティID
 */
export function createBattleMedarotEntity(world, medarotData, initialPosition = null, teamId = null, isLeader = false) {
    // 1. 新しいEntity IDを生成
    const entityId = world.createEntity();

    // 2. medarotData から必要な情報を取り出す
    const { name, partsIds, medalId } = medarotData;
    let finalName = name;
    let personality = null;

    // 2.1 メダル情報の決定
    if (medalId && MEDALS_DATA[medalId]) {
        const medalData = MEDALS_DATA[medalId];
        if (medalData) {
            finalName = medalData.name;
            personality = medalData.personality;
        }
    } else {
        // メダル情報がない場合、名前のみ medarotData から利用
        // personality はランダム or デフォルトで後でセット？
        // TODO: personality の fallback ロジックを検討
    }

    // 2.2 パーツ情報の初期化
    const initializedParts = {
        head: buildPartData(partsIds.head, 'head'),
        rightArm: buildPartData(partsIds.rightArm, 'rightArm'),
        leftArm: buildPartData(partsIds.leftArm, 'leftArm'),
        legs: buildPartData(partsIds.legs, 'legs')
    };

    // 3. 各コンポーネントを構築して、World に追加する
    // - 関数の引数で渡された値を使用
    world.addComponent(entityId, new CommonComponents.PlayerInfo(finalName, teamId, isLeader));
    world.addComponent(entityId, new BattleComponents.Gauge('ACTION')); // 例: 行動ゲージ
    world.addComponent(entityId, new BattleComponents.GameState()); // TODO: 初期状態を渡すか？
    world.addComponent(entityId, new CommonComponents.Parts(
        initializedParts.head,
        initializedParts.rightArm,
        initializedParts.leftArm,
        initializedParts.legs
    ));
    world.addComponent(entityId, new BattleComponents.Action()); // TODO: 初期アクション？
    world.addComponent(entityId, new CommonComponents.Medal(personality));
    world.addComponent(entityId, new BattleComponents.BattleLog()); // TODO: 必要か？
    if (initialPosition) {
        world.addComponent(entityId, new BattleComponents.Position(initialPosition.x, initialPosition.y));
    }
    world.addComponent(entityId, new BattleComponents.ActiveEffects()); // TODO: 初期エフェクト？
    world.addComponent(entityId, new BattleComponents.Visual()); // 表示用コンポーネント

    // 4. 最後に、作成したエンティティIDを返す
    return entityId;
}