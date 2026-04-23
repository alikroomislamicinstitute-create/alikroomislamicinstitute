const { RtcTokenBuilder, RtcRole } = require('agora-token');

exports.getAgoraToken = (req, res) => {
    // 1. Extract and Validate Inputs
    const { channelName } = req.query;
    const appId = process.env.AGORA_APP_ID;
    const appCertificate = process.env.AGORA_APP_CERTIFICATE;

    if (!channelName) {
        return res.status(400).json({ error: 'channelName is required' });
    }

    if (!appId || !appCertificate) {
        return res.status(500).json({ error: 'Agora credentials are not configured on the server' });
    }

    // 2. Determine User Role
    // Combined logic: If the user is a teacher, they are a PUBLISHER. 
    // Otherwise, we default to the logic provided in your update.
    const role = (req.user && req.user.role === 'teacher') 
        ? RtcRole.PUBLISHER 
        : RtcRole.PUBLISHER; // Set to PUBLISHER as per your requested change for 2-way chat

    // 3. Set Expiration (1 hour)
    const expirationInSeconds = 3600;
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpireTime = currentTimestamp + expirationInSeconds;

    // 4. Build the Token
    // Using 0 as UID allows Agora to auto-assign a UID to the user
    const uid = 0; 

    try {
        const token = RtcTokenBuilder.buildTokenWithUid(
            appId,
            appCertificate,
            channelName,
            uid,
            role,
            privilegeExpireTime
        );

        return res.json({
            success: true,
            token,
            appId,
            channelName,
            uid
        });
    } catch (error) {
        console.error('Error generating Agora token:', error);
        return res.status(500).json({ error: 'Failed to generate token' });
    }
};