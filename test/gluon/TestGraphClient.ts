export class TestGraphClient {
    public endpoint: string;
    public path: string;
    public query: string;
    public mutation: string;
    public var: any;

    public executeQueryFromFile<T, Q>(path: string, variables?: Q, options?: any, current?: string): Promise<any> {
        this.path = path;
        const json = {
         ChatId: [
             {
             userId: "U967SDE6",
             screenName: "Test.User", // Throws error with variables.userId
            },
         ],
        };
        return Promise.resolve(json);
    }

    public executeMutationFromFile<T, Q>(path: string, variables?: Q, options?: any, current?: string): Promise<any> {
        this.path = path;
        return Promise.resolve();
    }

}
