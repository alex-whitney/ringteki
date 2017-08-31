const DrawCard = require('../../../drawcard');

class IsawaMoriSeido extends DrawCard {
    setupCardAbilities(ability) {
        this.action({
            title: '+2 glory',
            cost: ability.costs.bowSelf(),
            target: {
                activePromptTitle: 'Select a character',
                cardCondition: card => card.location === 'play area'
                    && card.getType() === 'character'
            },
            handler: context => {
                this.game.addMessage('{0} uses {1} to give +2 glory to {2}', context.player, this, context.target);
                context.target.untilEndOfPhase(ability => ({
                    match: context.target,
                    effect: ability.effects.modifyGlory(2)
                }));
            }
        });
    }
}

IsawaMoriSeido.code = '01005';

module.exports = IsawaMoriSeido;