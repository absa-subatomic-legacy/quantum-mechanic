export interface MetaData {
    description: string;
    metadataEntries: MetaDataEntries[];
}

export interface MetaDataEntries {
    key: string;
    value: string;
}
