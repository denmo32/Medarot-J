/**
 * @file オブジェクトプール
 * @description 再利用可能なオブジェクトを管理し、GC負荷を低減する。
 */
export class ObjectPool {
    /**
     * @param {Function} factoryFn オブジェクト生成関数
     * @param {Function} resetFn オブジェクトリセット関数
     * @param {number} initialSize 初期サイズ
     */
    constructor(factoryFn, resetFn, initialSize = 10) {
        this.factory = factoryFn;
        this.reset = resetFn;
        this.pool = [];
        
        for (let i = 0; i < initialSize; i++) {
            this.pool.push(this.factory());
        }
    }

    /**
     * オブジェクトを取得する
     */
    acquire() {
        if (this.pool.length > 0) {
            return this.pool.pop();
        }
        return this.factory();
    }

    /**
     * オブジェクトを返却する
     * @param {any} obj 
     */
    release(obj) {
        this.reset(obj);
        this.pool.push(obj);
    }
}