import { google } from "googleapis";

export function getDriveOAuth2Client() {
    return new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/api/google/drive/callback`
    );
}

export function getDriveAuthUrl() {
    const oauth2Client = getDriveOAuth2Client();
    return oauth2Client.generateAuthUrl({
        access_type: "offline",
        prompt: "consent",
        scope: [
            "https://www.googleapis.com/auth/drive.file",
        ],
    });
}

export async function getDriveClient(accessToken: string, refreshToken: string) {
    const oauth2Client = getDriveOAuth2Client();
    oauth2Client.setCredentials({
        access_token: accessToken,
        refresh_token: refreshToken,
    });
    return google.drive({ version: "v3", auth: oauth2Client });
}

/**
 * Lists folders inside a given parent folder.
 * parentId = "root" for root of My Drive.
 */
export async function listDriveFolder(
    accessToken: string,
    refreshToken: string,
    parentId: string = "root"
) {
    const drive = await getDriveClient(accessToken, refreshToken);
    const res = await drive.files.list({
        q: `'${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: "files(id, name, webViewLink, createdTime)",
        orderBy: "name",
        pageSize: 100,
    });
    return res.data.files || [];
}

/**
 * Creates a folder in Google Drive.
 * If parentFolderId is provided, creates inside that folder.
 */
export async function createBookingFolder(
    accessToken: string,
    refreshToken: string,
    folderName: string,
    parentFolderId?: string
) {
    const drive = await getDriveClient(accessToken, refreshToken);

    const fileMetadata: any = {
        name: folderName,
        mimeType: "application/vnd.google-apps.folder",
    };

    if (parentFolderId) {
        fileMetadata.parents = [parentFolderId];
    }

    const res = await drive.files.create({
        requestBody: fileMetadata,
        fields: "id, webViewLink",
    });

    return {
        folderId: res.data.id,
        folderUrl: res.data.webViewLink,
    };
}

/**
 * Finds a folder by name under a parent, or creates one if not found.
 */
export async function findOrCreateFolder(
    accessToken: string,
    refreshToken: string,
    folderName: string,
    parentId: string = "root"
) {
    const drive = await getDriveClient(accessToken, refreshToken);

    // Search for existing folder
    const search = await drive.files.list({
        q: `name='${folderName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: "files(id, webViewLink)",
        pageSize: 1,
    });

    if (search.data.files && search.data.files.length > 0) {
        return {
            folderId: search.data.files[0].id!,
            folderUrl: search.data.files[0].webViewLink || null,
        };
    }

    // Create folder
    return createBookingFolder(accessToken, refreshToken, folderName, parentId);
}

/**
 * Uploads a file (Buffer) to a specific Google Drive folder.
 * Returns the file's webViewLink.
 */
export async function uploadFileToDrive(
    accessToken: string,
    refreshToken: string,
    fileName: string,
    mimeType: string,
    fileBuffer: Buffer,
    parentFolderId: string
) {
    const drive = await getDriveClient(accessToken, refreshToken);
    const { Readable } = require("stream");

    const res = await drive.files.create({
        requestBody: {
            name: fileName,
            parents: [parentFolderId],
        },
        media: {
            mimeType,
            body: Readable.from(fileBuffer),
        },
        fields: "id, webViewLink, webContentLink",
    });

    return {
        fileId: res.data.id,
        fileUrl: res.data.webViewLink,
        downloadUrl: res.data.webContentLink,
    };
}
