/**
 * @file BattleResult.js
 * @description 戦闘結果を保持するコンポーネント。
 * ゲーム終了時に生成され、勝者情報などを保持する。
 */
export class BattleResult {
    /**
     * @param {string} winningTeam - 勝者のチームID
     */
    constructor(winningTeam) {
        this.winningTeam = winningTeam;
        // 将来的に報酬データやMVPなどをここに追加可能
    }
}