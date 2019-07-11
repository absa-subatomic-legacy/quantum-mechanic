export interface QMMetaData {
    description: string;
    metadataEntries: QMMetaDataEntries[];
}

export interface QMMetaDataEntries {
    key: string;
    value: string;
}
