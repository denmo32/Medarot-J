/**
 * @file AIターゲティング戦略定義
 * このファイルは、AIの「メダルの性格」に基づいた多様なターゲティング戦略（アルゴリズム）を定義します。
 */
import { Parts, PlayerInfo, GameState, BattleLog, GameContext } from '../core/components.js';
import { PartType, PlayerStateType, MedalPersonality } from '../common/constants.js';
// ★追加: battleUtilsから関数をインポート
import { isValidTarget, selectRandomPart, getAllEnemyParts, selectPartByCondition } from '../utils/battleUtils.js';
/**
 * メダルの性格に基づいたターゲット決定戦略のコレクション。
 * なぜこの形式なのか？
 * これは「ストラテジーパターン」と呼ばれる設計パターンの一種です。AIの性格（戦略）ごとにアルゴリズムを分離して管理することで、
 * 新しい性格（例えば「回復パーツを優先的に狙う」など）を追加したくなった場合に、このオブジェクトに新しい関数を追加するだけで済み、
 * 他のコードに影響を与えることなく、容易にAIのバリエーションを増やすことができます。
 */
export const targetingStrategies = {
    /**
     * [HUNTER]: 弱った敵から確実に仕留める、狩人のような性格。
     * 敵全体のパーツの中で、現在HPが最も低いものを狙います。
     */
    [MedalPersonality.HUNTER]: (world, attackerId, enemies) => {
        return selectPartByCondition(world, enemies, (a, b) => a.part.hp - b.part.hp);
    },
    /**
     * [CRUSHER]: 頑丈なパーツを先に破壊し、敵の耐久力を削ぐ、破壊者のような性格。
     * 敵全体のパーツの中で、現在HPが最も高いものを狙います。
     */
    [MedalPersonality.CRUSHER]: (world, attackerId, enemies) => {
        return selectPartByCondition(world, enemies, (a, b) => b.part.hp - a.part.hp);
    },
    /**
     * [JOKER]: 行動が予測不能で、戦況をかき乱す、トリックスターのような性格。
     * 敵全体の「攻撃可能な全パーツ」を一つの大きなリストとみなし、その中から完全にランダムで1つをターゲットとします。
     * 結果として、健在なパーツを多く持つ敵が狙われやすくなります。
     */
    [MedalPersonality.JOKER]: (world, attackerId, enemies) => {
        const allParts = getAllEnemyParts(world, enemies);
        if (allParts.length === 0) return null;
        const randomIndex = Math.floor(Math.random() * allParts.length);
        return { targetId: allParts[randomIndex].entityId, targetPartKey: allParts[randomIndex].partKey };
    },
    /**
     * [COUNTER]: 受けた攻撃に即座にやり返す、短期的な性格。
     * 自分を最後に攻撃してきた敵を狙います。いなければ、フォールバックとして別の戦略が選択されます。
     * 
     * ★変更: 以前はtargetIdの有効性をチェックしていましたが、
     * そのチェックはdetermineTarget関数で一元管理するよう変更しました。
     * これにより、各戦略関数は単にターゲットを返すだけになり、
     * 有効性のチェックはdetermineTargetで一括処理されるようになります。
     */
    [MedalPersonality.COUNTER]: (world, attackerId, enemies) => {
        const attackerLog = world.getComponent(attackerId, BattleLog);
        const targetId = attackerLog.lastAttackedBy;
        return targetId ? selectRandomPart(world, targetId) : null;
    },
    /**
     * [GUARD]: リーダーを守ることを最優先する、護衛のような性格。
     * 味方チームのリーダーを最後に攻撃した敵を狙います。
     * 
     * ★変更: 以前はtargetIdの有効性をチェックしていましたが、
     * そのチェックはdetermineTarget関数で一元管理するよう変更しました。
     * これにより、各戦略関数は単にターゲットを返すだけになり、
     * 有効性のチェックはdetermineTargetで一括処理されるようになります。
     */
    [MedalPersonality.GUARD]: (world, attackerId, enemies) => {
        const attackerInfo = world.getComponent(attackerId, PlayerInfo);
        const context = world.getSingletonComponent(GameContext);
        const targetId = context.leaderLastAttackedBy[attackerInfo.teamId];
        return targetId ? selectRandomPart(world, targetId) : null;
    },
    /**
     * [FOCUS]: 一度狙った獲物は逃さない、執拗な性格。
     * 自分が前回攻撃したのと同じパーツを、執拗に狙い続けます。
     * 
     * ★変更: 以前はtargetIdとpartKeyの有効性をチェックしていましたが、
     * そのチェックはdetermineTarget関数で一元管理するよう変更しました。
     * これにより、各戦略関数は単にターゲットを返すだけになり、
     * 有効性のチェックはdetermineTargetで一括処理されるようになります。
     */
    [MedalPersonality.FOCUS]: (world, attackerId, enemies) => {
        const attackerLog = world.getComponent(attackerId, BattleLog);
        const lastAttack = attackerLog.lastAttack;
        return { targetId: lastAttack.targetId, targetPartKey: lastAttack.partKey };
    },
    /**
     * [ASSIST]: 味方と連携して同じ敵を攻撃する、協調的な性格。
     * 味方が最後に攻撃した敵のパーツを狙い、集中攻撃を仕掛けます。
     * 
     * ★変更: 以前はtargetIdとpartKeyの有効性をチェックしていましたが、
     * そのチェックはdetermineTarget関数で一元管理するよう変更しました。
     * これにより、各戦略関数は単にターゲットを返すだけになり、
     * 有効性のチェックはdetermineTargetで一括処理されるようになります。
     */
    [MedalPersonality.ASSIST]: (world, attackerId, enemies) => {
        const attackerInfo = world.getComponent(attackerId, PlayerInfo);
        const context = world.getSingletonComponent(GameContext);
        const teamLastAttack = context.teamLastAttack[attackerInfo.teamId];
        return { targetId: teamLastAttack.targetId, targetPartKey: teamLastAttack.partKey };
    },
    /**
     * [LEADER_FOCUS]: リーダーを集中攻撃し、早期決着を狙う、極めて攻撃的な性格。
     * 戦略の基本として、敵チームのリーダーを最優先で狙います。
     * 
     * ★変更: 以前はleaderの有効性をチェックしていましたが、
     * そのチェックはdetermineTarget関数で一元管理するよう変更しました。
     * これにより、各戦略関数は単にターゲットを返すだけになり、
     * 有効性のチェックはdetermineTargetで一括処理されるようになります。
     */
    [MedalPersonality.LEADER_FOCUS]: (world, attackerId, enemies) => {
        const leader = enemies.find(id => world.getComponent(id, PlayerInfo).isLeader);
        return leader ? selectRandomPart(world, leader) : null;
    },
    /**
     * [RANDOM]: 基本的な性格であり、他の戦略が条件を満たさず実行できない場合の安全策（フォールバック）としての役割も持ちます。
     * まず「敵1体」をランダムに選び、次にその敵のパーツをランダムに狙います。
     * どの敵機体も等しい確率で選ばれます。
     */
    [MedalPersonality.RANDOM]: (world, attackerId, enemies) => {
        if (enemies.length === 0) return null;
        const targetId = enemies[Math.floor(Math.random() * enemies.length)];
        return selectRandomPart(world, targetId);
    }
};