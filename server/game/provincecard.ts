const _ = require('underscore');

import { BaseCard, BaseCardSummary } from './basecard';
import { Player } from "./player";

export interface ProvinceCardSummary extends BaseCardSummary {
    strength: number;
    isBroken: boolean;
}

export class ProvinceCard extends BaseCard {
    strengthModifier = 0;
    isBroken = false;

    constructor(owner, cardData) {
        super(owner, cardData);

        this.isProvince = true;
    }

    getStrength(): number {
        return this.cardData.strength + this.strengthModifier;
    }

    flipFaceup() {
        this.facedown = false;
    }
    
    breakProvince() {
        this.isBroken = true;
    }

    getSummary(activePlayer: Player, hideWhenFaceup): ProvinceCardSummary {
        let baseSummary = super.getSummary(activePlayer, hideWhenFaceup);

        return _.extend(baseSummary, {
            isProvince: this.isProvince,
            strength: this.getStrength(),
            isBroken: this.isBroken
        });
    }

}
