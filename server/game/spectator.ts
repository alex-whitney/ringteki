export class Spectator {
    user;
    name;
    emailHash;
    id;
    buttons: Array<any> = [];
    menuTitle: 'Spectator mode';

    constructor(id, user) {
        this.user = user;
        this.name = this.user.username;
        this.emailHash = this.user.emailHash;
        this.id = id;
    }

    getCardSelectionState(card: any): any {
        return {};
    }
}
