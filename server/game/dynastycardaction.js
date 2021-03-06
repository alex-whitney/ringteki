const BaseAbility = require('./baseability.js');
const Costs = require('./costs.js');
const ChooseFate = require('./costs/choosefate.js');

class DynastyCardAction extends BaseAbility {
    constructor() {
        super({
            cost: [
                new ChooseFate(),
                Costs.payReduceableFateCost('dynasty'),
                Costs.playLimited()
            ]
        });
        this.title = 'Dynasty';
    }

    meetsRequirements(context) {
        var {game, player, source} = context;

        return (
            game.currentPhase === 'dynasty' &&
            source.isDynasty &&
            !source.facedown &&
            source.getType() === 'character' &&
            player.isCardInPlayableLocation(source, 'dynasty') &&
            player.canPutIntoPlay(source) &&
            game.currentActionWindow &&
            game.currentActionWindow.currentPlayer === player &&
            game.abilityCardStack.length === 1
        );
    }

    executeHandler(context) {
        
        let additionalFate = this.cost[0].fate;
        let location = context.source.location;
        
        context.source.fate = additionalFate;
        context.player.putIntoPlay(context.source, 'dynasty');
        context.player.replaceDynastyCard(location);
        
        context.game.addMessage('{0} plays {1} with {2} additional fate', context.player, context.source.name, additionalFate);
    }

    isCardAbility() {
        return false;
    }
}

module.exports = DynastyCardAction;
