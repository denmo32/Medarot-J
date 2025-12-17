/**
 * @file createBattleMedarotEntity.js
 * @description バトル用のメダロットエンティティを生成する。
 * GameStateコンポーネントを削除し、初期タグ（IsCooldown）を付与。
 */

import * as BattleComponents from '../battle/components/index.js';
import * as CommonComponents from '../components/index.js';
import { MEDALS_DATA } from '../data/medals.js';
import { PARTS_DATA } from '../data/parts.js';
import { buildPartData } from '../data/partDataUtils.js';

export function createBattleMedarotEntity(world, medarotData, initialPosition = null, teamId = null, isLeader = false) {
    const entityId = world.createEntity();

    const { name, partsIds, medalId } = medarotData;
    let finalName = name;
    let personality = null;

    if (medalId && MEDALS_DATA[medalId]) {
        const medalData = MEDALS_DATA[medalId];
        if (medalData) {
            finalName = medalData.name;
            personality = medalData.personality;
        }
    }

    const initializedParts = {
        head: buildPartData(partsIds.head, 'head'),
        rightArm: buildPartData(partsIds.rightArm, 'rightArm'),
        leftArm: buildPartData(partsIds.leftArm, 'leftArm'),
        legs: buildPartData(partsIds.legs, 'legs')
    };

    world.addComponent(entityId, new CommonComponents.PlayerInfo(finalName, teamId, isLeader));
    world.addComponent(entityId, new BattleComponents.Gauge('ACTION'));
    
    // 初期状態タグ: クールダウン中（スタートラインに戻る状態、あるいはそこに居る状態）
    world.addComponent(entityId, new BattleComponents.IsCooldown());

    world.addComponent(entityId, new CommonComponents.Parts(
        initializedParts.head,
        initializedParts.rightArm,
        initializedParts.leftArm,
        initializedParts.legs
    ));
    world.addComponent(entityId, new BattleComponents.Action());
    world.addComponent(entityId, new CommonComponents.Medal(personality));
    world.addComponent(entityId, new BattleComponents.BattleLog());
    if (initialPosition) {
        world.addComponent(entityId, new BattleComponents.Position(initialPosition.x, initialPosition.y));
    }
    world.addComponent(entityId, new BattleComponents.ActiveEffects());
    world.addComponent(entityId, new BattleComponents.Visual());

    return entityId;
}