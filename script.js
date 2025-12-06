[file name]: script.js
[file content begin]
// script.js — COMPLETE VERSION WITH EMAIL, SMS & AUTOMATION
// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-analytics.js";
import {
  getFirestore, collection, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc,
  onSnapshot, query, where, serverTimestamp, writeBatch, orderBy, addDoc
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyBNuIYfcsi2NWkK1Ua4Tnycaf_qM3oix1s",
  authDomain: "neon-voting-app.firebaseapp.com",
  projectId: "neon-voting-app",
  storageBucket: "neon-voting-app.firebasestorage.app",
  messagingSenderId: "406871836482",
  appId: "1:406871836482:web:b25063cd3829cd3dc6aadb",
  measurementId: "G-VGW2Z3FR8M"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);

// Global variables
let currentOrgId = null;
let currentOrgData = null;
let currentECSession = null;
let currentVoterSession = null;

// EmailJS Configuration (For Email Sending)
const EMAILJS_CONFIG = {
  serviceId: 'default_service', // You'll need to create at emailjs.com
  templateId: 'neon_voting_template', // Create your template
  userId: 'YOUR_EMAILJS_USER_ID' // Get from EmailJS dashboard
};

// Twilio SMS Configuration (For SMS Sending - Optional)
const SMS_CONFIG = {
  enabled: false, // Set to true if you have Twilio API
  accountSid: '',
  authToken: '',
  fromNumber: '+1234567890'
};

// Enhanced Toast function
function showToast(msg, type = "info", duration = 3000) {
  let toast = document.getElementById("toast");
  if (!toast) {
    toast = document.createElement('div');
    toast.id = "toast";
    document.body.appendChild(toast);
  }
  
  toast.textContent = msg;
  toast.style.background = type === "error" ? "linear-gradient(90deg, #d32f2f, #b71c1c)" :
                       type === "success" ? "linear-gradient(90deg, #00C851, #007E33)" :
                       type === "warning" ? "linear-gradient(90deg, #ff9800, #f57c00)" :
                       "linear-gradient(90deg, #9D00FF, #00C3FF)";
  toast.style.border = type === "error" ? "1px solid rgba(255,68,68,0.3)" : "1px solid rgba(0,255,255,0.2)";
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), duration);
}

// Screen navigation
function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const targetScreen = document.getElementById(screenId);
  if (targetScreen) {
    targetScreen.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

// ==================== EMAIL & SMS FUNCTIONS ====================

/**
 * Send Email using EmailJS
 * @param {string} toEmail - Recipient email
 * @param {string} subject - Email subject
 * @param {string} htmlContent - HTML email content
 * @param {string} textContent - Plain text email content
 */
async function sendEmail(toEmail, subject, htmlContent, textContent) {
  try {
    // Check if EmailJS is loaded
    if (typeof emailjs === 'undefined') {
      console.warn('EmailJS not loaded, using fallback');
      return sendEmailFallback(toEmail, subject, htmlContent, textContent);
    }
    
    const templateParams = {
      to_email: toEmail,
      subject: subject,
      html_content: htmlContent,
      text_content: textContent,
      reply_to: 'noreply@neonvoting.com',
      from_name: 'Neon Voting System'
    };
    
    await emailjs.send(
      EMAILJS_CONFIG.serviceId,
      EMAILJS_CONFIG.templateId,
      templateParams,
      EMAILJS_CONFIG.userId
    );
    
    console.log('Email sent successfully to:', toEmail);
    return { success: true, message: 'Email sent successfully' };
    
  } catch (error) {
    console.error('Email sending failed:', error);
    return { success: false, message: 'Email sending failed: ' + error.message };
  }
}

/**
 * Fallback email function using Formspree or similar service
 */
async function sendEmailFallback(toEmail, subject, htmlContent, textContent) {
  try {
    // Using Formspree as fallback (free tier available)
    const response = await fetch('https://formspree.io/f/YOUR_FORM_ID', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        _replyto: toEmail,
        email: toEmail,
        subject: subject,
        message: textContent,
        _subject: `[Neon Voting] ${subject}`,
        _format: 'plain'
      })
    });
    
    if (response.ok) {
      return { success: true, message: 'Email sent via fallback' };
    } else {
      throw new Error('Fallback email failed');
    }
  } catch (error) {
    console.error('Fallback email failed:', error);
    return { success: false, message: 'Email service unavailable' };
  }
}

/**
 * Send SMS using Twilio API
 * @param {string} phoneNumber - Recipient phone number
 * @param {string} message - SMS message content
 */
async function sendSMS(phoneNumber, message) {
  try {
    // Check if SMS is enabled
    if (!SMS_CONFIG.enabled) {
      console.warn('SMS sending is disabled in config');
      return { success: false, message: 'SMS service is disabled' };
    }
    
    // Format phone number for Ghana
    let formattedPhone = phoneNumber;
    if (phoneNumber.startsWith('0')) {
      formattedPhone = '+233' + phoneNumber.substring(1);
    } else if (!phoneNumber.startsWith('+')) {
      formattedPhone = '+233' + phoneNumber;
    }
    
    // Using Twilio REST API
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${SMS_CONFIG.accountSid}/Messages.json`, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa(SMS_CONFIG.accountSid + ':' + SMS_CONFIG.authToken),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        To: formattedPhone,
        From: SMS_CONFIG.fromNumber,
        Body: message
      })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      console.log('SMS sent successfully to:', formattedPhone);
      return { success: true, message: 'SMS sent successfully', sid: data.sid };
    } else {
      throw new Error(data.message || 'SMS sending failed');
    }
    
  } catch (error) {
    console.error('SMS sending failed:', error);
    return { success: false, message: 'SMS sending failed: ' + error.message };
  }
}

/**
 * Send EC Invitation via Email and/or SMS
 * @param {string} orgId - Organization ID
 * @param {string} ecEmail - EC Email address
 * @param {string} ecPhone - EC Phone number
 * @param {string} ecPassword - EC Password
 */
async function sendECInvitation(orgId, ecEmail, ecPhone, ecPassword) {
  try {
    // Get organization data
    const orgRef = doc(db, "organizations", orgId);
    const orgSnap = await getDoc(orgRef);
    
    if (!orgSnap.exists()) {
      return { success: false, message: 'Organization not found' };
    }
    
    const orgData = orgSnap.data();
    const orgName = orgData.name || orgId;
    
    // Generate EC login link
    const ecLoginLink = `${window.location.origin}?org=${orgId}&role=ec`;
    
    // Create invitation content
    const emailSubject = `Election Commissioner Invitation - ${orgName}`;
    
    const emailHtmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(90deg, #9D00FF, #00C3FF); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .credentials { background: #fff; border: 2px dashed #00C3FF; padding: 15px; margin: 20px 0; border-radius: 8px; }
          .button { display: inline-block; background: linear-gradient(90deg, #9D00FF, #00C3FF); color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 You're Invited as Election Commissioner</h1>
            <p>Neon Voting System - ${orgName}</p>
          </div>
          <div class="content">
            <h2>Welcome to Neon Voting System!</h2>
            <p>You have been appointed as an <strong>Election Commissioner (EC)</strong> for <strong>${orgName}</strong>.</p>
            
            <div class="credentials">
              <h3>🔑 Your Login Credentials:</h3>
              <p><strong>Organization ID:</strong> ${orgId}</p>
              <p><strong>EC Password:</strong> <code style="background: #f0f0f0; padding: 5px 10px; border-radius: 4px;">${ecPassword}</code></p>
            </div>
            
            <h3>🚀 Quick Login:</h3>
            <p>Click the button below to login directly:</p>
            <p>
              <a href="${ecLoginLink}" class="button">Login as Election Commissioner</a>
            </p>
            
            <p>Or visit: <a href="${ecLoginLink}">${ecLoginLink}</a></p>
            
            <h3>📋 Your Responsibilities:</h3>
            <ul>
              <li>Manage voters and their details</li>
              <li>Add election positions and candidates</li>
              <li>Monitor live voting progress</li>
              <li>Send voting links to voters</li>
              <li>View election outcomes</li>
            </ul>
            
            <p><strong>Note:</strong> Please keep your password secure and do not share it.</p>
            
            <div class="footer">
              <p>This is an automated message from Neon Voting System.</p>
              <p>If you did not expect this invitation, please ignore this email.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
    
    const emailTextContent = `
      ELECTION COMMISSIONER INVITATION - ${orgName}
      
      You have been appointed as Election Commissioner (EC) for ${orgName}.
      
      CREDENTIALS:
      Organization ID: ${orgId}
      EC Password: ${ecPassword}
      
      LOGIN LINK: ${ecLoginLink}
      
      Your responsibilities include managing voters, positions, candidates, and monitoring voting progress.
      
      Please keep your password secure.
      
      This is an automated message from Neon Voting System.
    `;
    
    // SMS Content
    const smsContent = `Neon Voting: You're appointed as EC for ${orgName}. Login: ${ecLoginLink} Password: ${ecPassword}. Keep password secure.`;
    
    // Send emails
    let emailResult = { success: false };
    if (ecEmail) {
      emailResult = await sendEmail(ecEmail, emailSubject, emailHtmlContent, emailTextContent);
    }
    
    // Send SMS
    let smsResult = { success: false };
    if (ecPhone && SMS_CONFIG.enabled) {
      smsResult = await sendSMS(ecPhone, smsContent);
    }
    
    // Log the invitation
    const invitationLog = {
      orgId: orgId,
      orgName: orgName,
      ecEmail: ecEmail,
      ecPhone: ecPhone,
      ecPassword: ecPassword,
      emailSent: emailResult.success,
      smsSent: smsResult.success,
      sentAt: serverTimestamp(),
      loginLink: ecLoginLink
    };
    
    await addDoc(collection(db, "organizations", orgId, "invitations"), invitationLog);
    
    // Update organization with EC contact info
    await updateDoc(orgRef, {
      ecEmail: ecEmail || '',
      ecPhone: ecPhone || '',
      lastInvitationSent: serverTimestamp()
    });
    
    // Return results
    return {
      success: emailResult.success || smsResult.success,
      email: emailResult,
      sms: smsResult,
      message: `Invitation ${emailResult.success ? 'emailed' : ''} ${smsResult.success ? 'SMS sent' : ''}`
    };
    
  } catch (error) {
    console.error('Error sending EC invitation:', error);
    return { success: false, message: 'Failed to send invitation: ' + error.message };
  }
}

/**
 * Send Voter Voting Link via Email and/or SMS
 * @param {string} voterId - Voter ID
 * @param {object} voterData - Voter data
 */
async function sendVoterLink(voterId, voterData) {
  try {
    if (!currentOrgId) {
      return { success: false, message: 'No organization selected' };
    }
    
    const orgRef = doc(db, "organizations", currentOrgId);
    const orgSnap = await getDoc(orgRef);
    
    if (!orgSnap.exists()) {
      return { success: false, message: 'Organization not found' };
    }
    
    const orgData = orgSnap.data();
    const orgName = orgData.name || currentOrgId;
    
    // Generate voter voting link
    const voterEmail = voterData.email;
    const voterPhone = voterData.phone;
    const votingLink = `${window.location.origin}?org=${currentOrgId}&voter=${encodeURIComponent(voterEmail || voterPhone)}`;
    
    // Email Content
    const emailSubject = `Your Voting Link - ${orgName}`;
    
    const emailHtmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(90deg, #FF9800, #9D00FF); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .voting-card { background: #fff; border: 3px solid #9D00FF; padding: 20px; margin: 20px 0; border-radius: 10px; text-align: center; }
          .button { display: inline-block; background: linear-gradient(90deg, #FF9800, #9D00FF); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; }
          .info-box { background: #e8f4ff; border-left: 4px solid #00C3FF; padding: 15px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🗳️ Your Voting Link is Ready!</h1>
            <p>${orgName} - Neon Voting System</p>
          </div>
          <div class="content">
            <h2>Hello ${voterData.name || 'Voter'}!</h2>
            <p>You have been registered to vote in <strong>${orgName}</strong>.</p>
            
            <div class="voting-card">
              <h3>🎯 Cast Your Vote</h3>
              <p>Click the button below to access your secure voting ballot:</p>
              <p>
                <a href="${votingLink}" class="button">Vote Now</a>
              </p>
              <p style="font-size: 12px; color: #666; margin-top: 10px;">
                Or copy this link: ${votingLink}
              </p>
            </div>
            
            <div class="info-box">
              <h4>📋 Voting Instructions:</h4>
              <ol>
                <li>Click the "Vote Now" button above</li>
                <li>Enter your email/phone to receive OTP</li>
                <li>Enter the 6-digit OTP sent to you</li>
                <li>Select your preferred candidates</li>
                <li>Submit your vote securely</li>
              </ol>
            </div>
            
            <h4>🛡️ Security Notes:</h4>
            <ul>
              <li>This link is unique to you - do not share it</li>
              <li>You will need to verify with OTP each time</li>
              <li>Your vote is encrypted and anonymous</li>
              <li>You can only vote once</li>
            </ul>
            
            <p><strong>Voting Period:</strong> ${formatVotingPeriod(orgData)}</p>
            
            <div class="footer">
              <p>This is an automated message from Neon Voting System.</p>
              <p>If you have questions, contact your Election Commissioner.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
    
    const emailTextContent = `
      YOUR VOTING LINK - ${orgName}
      
      Hello ${voterData.name || 'Voter'}!
      
      You have been registered to vote in ${orgName}.
      
      VOTING LINK: ${votingLink}
      
      VOTING INSTRUCTIONS:
      1. Click the voting link above
      2. Enter your email/phone to receive OTP
      3. Enter the 6-digit OTP sent to you
      4. Select your preferred candidates
      5. Submit your vote securely
      
      SECURITY NOTES:
      - This link is unique to you - do not share it
      - You will need to verify with OTP each time
      - Your vote is encrypted and anonymous
      - You can only vote once
      
      Voting Period: ${formatVotingPeriod(orgData)}
      
      This is an automated message from Neon Voting System.
    `;
    
    // SMS Content
    const smsContent = `Neon Voting: Vote in ${orgName}. Link: ${votingLink}. Use ${voterEmail || voterPhone} to login. OTP will be sent.`;
    
    // Send emails
    let emailResult = { success: false };
    if (voterEmail) {
      emailResult = await sendEmail(voterEmail, emailSubject, emailHtmlContent, emailTextContent);
    }
    
    // Send SMS
    let smsResult = { success: false };
    if (voterPhone && SMS_CONFIG.enabled) {
      smsResult = await sendSMS(voterPhone, smsContent);
    }
    
    // Log the voter link sent
    const linkLog = {
      voterId: voterId,
      voterEmail: voterEmail,
      voterPhone: voterPhone,
      emailSent: emailResult.success,
      smsSent: smsResult.success,
      sentAt: serverTimestamp(),
      votingLink: votingLink,
      orgName: orgName
    };
    
    await addDoc(collection(db, "organizations", currentOrgId, "voterLinks"), linkLog);
    
    // Update voter record
    const voterRef = doc(db, "organizations", currentOrgId, "voters", voterId);
    await updateDoc(voterRef, {
      linkSent: true,
      lastLinkSent: serverTimestamp(),
      linkSentVia: emailResult.success ? 'email' : (smsResult.success ? 'sms' : 'none')
    });
    
    return {
      success: emailResult.success || smsResult.success,
      email: emailResult,
      sms: smsResult,
      votingLink: votingLink
    };
    
  } catch (error) {
    console.error('Error sending voter link:', error);
    return { success: false, message: 'Failed to send voting link: ' + error.message };
  }
}

/**
 * Send Bulk Voter Links
 */
async function sendBulkVoterLinks(voterIds) {
  if (!voterIds || voterIds.length === 0) {
    return { success: false, message: 'No voters selected' };
  }
  
  showToast(`Sending links to ${voterIds.length} voters...`, 'info');
  
  const results = {
    total: voterIds.length,
    successful: 0,
    failed: 0,
    details: []
  };
  
  for (const voterId of voterIds) {
    try {
      const voterRef = doc(db, "organizations", currentOrgId, "voters", voterId);
      const voterSnap = await getDoc(voterRef);
      
      if (voterSnap.exists()) {
        const voterData = voterSnap.data();
        const result = await sendVoterLink(voterId, voterData);
        
        results.details.push({
          voterId: voterId,
          name: voterData.name,
          email: voterData.email,
          phone: voterData.phone,
          success: result.success
        });
        
        if (result.success) {
          results.successful++;
        } else {
          results.failed++;
        }
      }
    } catch (error) {
      console.error(`Error sending link to voter ${voterId}:`, error);
      results.failed++;
      results.details.push({
        voterId: voterId,
        success: false,
        error: error.message
      });
    }
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  return results;
}

/**
 * Send OTP to Voter
 */
async function sendOTP(toEmail, toPhone, otpCode) {
  try {
    const orgName = currentOrgData?.name || currentOrgId || 'Neon Voting';
    
    // Email Content for OTP
    const emailSubject = `Your OTP Code - ${orgName}`;
    
    const emailHtmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(90deg, #00C851, #00C3FF); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .otp-box { background: #fff; border: 3px solid #00C851; padding: 25px; margin: 20px 0; border-radius: 10px; text-align: center; }
          .otp-code { font-size: 36px; font-weight: bold; color: #00C851; letter-spacing: 10px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔐 Your OTP Code</h1>
            <p>${orgName} - Neon Voting System</p>
          </div>
          <div class="content">
            <h2>Authentication Required</h2>
            <p>Use the following One-Time Password (OTP) to verify your identity and access the voting system.</p>
            
            <div class="otp-box">
              <h3>Your 6-digit OTP Code:</h3>
              <div class="otp-code">${otpCode}</div>
              <p>Enter this code on the voting page to proceed.</p>
              <p style="color: #ff4444; font-size: 14px; margin-top: 15px;">
                ⚠️ This code expires in 10 minutes. Do not share it with anyone.
              </p>
            </div>
            
            <p><strong>Security Tip:</strong> Neon Voting will never ask for your password via email or SMS.</p>
            
            <div class="footer">
              <p>This is an automated message from Neon Voting System.</p>
              <p>If you didn't request this OTP, please ignore this message.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
    
    const emailTextContent = `
      OTP CODE - ${orgName}
      
      Your One-Time Password (OTP) for voting authentication:
      
      OTP: ${otpCode}
      
      Enter this code on the voting page to proceed.
      
      This code expires in 10 minutes. Do not share it with anyone.
      
      Security Tip: Neon Voting will never ask for your password via email or SMS.
      
      This is an automated message.
    `;
    
    // SMS Content for OTP
    const smsContent = `Neon Voting OTP: ${otpCode}. Valid for 10 minutes. Do not share.`;
    
    // Send OTP via email
    let emailResult = { success: false };
    if (toEmail) {
      emailResult = await sendEmail(toEmail, emailSubject, emailHtmlContent, emailTextContent);
    }
    
    // Send OTP via SMS
    let smsResult = { success: false };
    if (toPhone && SMS_CONFIG.enabled) {
      smsResult = await sendSMS(toPhone, smsContent);
    }
    
    return {
      success: emailResult.success || smsResult.success,
      email: emailResult,
      sms: smsResult,
      message: `OTP ${emailResult.success ? 'emailed' : ''} ${smsResult.success ? 'SMS sent' : ''}`
    };
    
  } catch (error) {
    console.error('Error sending OTP:', error);
    return { success: false, message: 'Failed to send OTP: ' + error.message };
  }
}

// Helper function to format voting period
function formatVotingPeriod(orgData) {
  if (!orgData.votingStart || !orgData.votingEnd) {
    return 'To be announced';
  }
  
  const start = new Date(orgData.votingStart).toLocaleString();
  const end = new Date(orgData.votingEnd).toLocaleString();
  return `${start} to ${end}`;
}

// ==================== ENHANCED EC INVITATION UI ====================

/**
 * Show EC Invitation Modal with Feedback
 */
async function showECInvitationModal(orgId) {
  try {
    const orgRef = doc(db, "organizations", orgId);
    const orgSnap = await getDoc(orgRef);
    
    if (!orgSnap.exists()) {
      showToast('Organization not found', 'error');
      return;
    }
    
    const orgData = orgSnap.data();
    const ecPassword = orgData.ecPassword || 'Not set';
    
    const modalContent = `
      <div style="padding:20px">
        <h3 style="color:#00eaff;margin-bottom:20px">
          <i class="fas fa-paper-plane"></i> Send EC Invitation - ${orgData.name || orgId}
        </h3>
        
        <div class="card" style="margin-bottom:20px">
          <h4><i class="fas fa-info-circle"></i> Current EC Credentials</h4>
          <p><strong>Organization ID:</strong> ${orgId}</p>
          <p><strong>EC Password:</strong> <code style="background:#f0f0f0;padding:2px 6px;border-radius:4px">${ecPassword}</code></p>
          <p><strong>Direct Login Link:</strong></p>
          <div class="link-box">
            ${window.location.origin}?org=${orgId}&role=ec
          </div>
          <button class="btn neon-btn-outline mt-10" onclick="copyToClipboard('${window.location.origin}?org=${orgId}&role=ec')">
            <i class="fas fa-copy"></i> Copy Link
          </button>
        </div>
        
        <div class="card">
          <h4><i class="fas fa-user-plus"></i> Send Invitation To:</h4>
          
          <div class="edit-form-group">
            <label class="label">EC Email Address</label>
            <input type="email" id="inviteECEmail" class="input" placeholder="ec@example.com" value="${orgData.ecEmail || ''}">
            <small class="subtext">Email will contain login link and password</small>
          </div>
          
          <div class="edit-form-group">
            <label class="label">EC Phone Number (Optional)</label>
            <input type="tel" id="inviteECPhone" class="input" placeholder="+233501234567" value="${orgData.ecPhone || ''}">
            <small class="subtext">For SMS invitation (requires Twilio setup)</small>
          </div>
          
          <div class="edit-form-group">
            <label class="label">Custom Message (Optional)</label>
            <textarea id="inviteCustomMessage" class="input" rows="3" placeholder="Add any additional instructions..."></textarea>
          </div>
          
          <div id="invitationPreview" class="hidden">
            <h4><i class="fas fa-eye"></i> Preview:</h4>
            <div class="email-preview" id="emailPreviewContent"></div>
            <div class="sms-preview" id="smsPreviewContent"></div>
          </div>
          
          <div class="edit-actions mt-20">
            <button class="btn neon-btn-outline" onclick="previewECInvitation('${orgId}')">
              <i class="fas fa-eye"></i> Preview
            </button>
            <button class="btn neon-btn" onclick="sendECInvitationNow('${orgId}')">
              <i class="fas fa-paper-plane"></i> Send Invitation
            </button>
            <button class="btn neon-btn-outline" onclick="closeModal('ecInviteModal')">
              Cancel
            </button>
          </div>
        </div>
        
        <div id="invitationStatus" class="hidden mt-20"></div>
      </div>
    `;
    
    // Create or update modal
    let modal = document.getElementById('ecInviteModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'ecInviteModal';
      modal.className = 'modal-overlay hidden';
      modal.innerHTML = `
        <div class="modal-card" style="max-width:700px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
            <h3><i class="fas fa-paper-plane"></i> Send EC Invitation</h3>
            <button class="btn neon-btn-outline" onclick="closeModal('ecInviteModal')">
              <i class="fas fa-times"></i>
            </button>
          </div>
          <div id="ecInviteContent"></div>
        </div>
      `;
      document.body.appendChild(modal);
    }
    
    document.getElementById('ecInviteContent').innerHTML = modalContent;
    modal.classList.remove('hidden');
    
  } catch (error) {
    console.error('Error showing EC invitation modal:', error);
    showToast('Failed to load invitation form', 'error');
  }
}

/**
 * Preview EC Invitation
 */
async function previewECInvitation(orgId) {
  const ecEmail = document.getElementById('inviteECEmail').value;
  const ecPhone = document.getElementById('inviteECPhone').value;
  
  if (!ecEmail && !ecPhone) {
    showToast('Enter email or phone number', 'warning');
    return;
  }
  
  // Show preview
  document.getElementById('invitationPreview').classList.remove('hidden');
  
  // Generate preview content
  const orgRef = doc(db, "organizations", orgId);
  const orgSnap = await getDoc(orgRef);
  const orgData = orgSnap.data();
  
  const emailPreview = `
    Subject: Election Commissioner Invitation - ${orgData.name || orgId}
    
    You have been appointed as Election Commissioner for ${orgData.name || orgId}.
    
    Login Link: ${window.location.origin}?org=${orgId}&role=ec
    Password: ${orgData.ecPassword}
    
    Please keep your password secure.
  `;
  
  const smsPreview = `Neon Voting: You're appointed as EC for ${orgData.name || orgId}. Login: ${window.location.origin}?org=${orgId}&role=ec Password: ${orgData.ecPassword}`;
  
  document.getElementById('emailPreviewContent').textContent = emailPreview;
  document.getElementById('smsPreviewContent').textContent = smsPreview;
}

/**
 * Send EC Invitation with Feedback
 */
async function sendECInvitationNow(orgId) {
  const ecEmail = document.getElementById('inviteECEmail').value;
  const ecPhone = document.getElementById('inviteECPhone').value;
  
  if (!ecEmail && !ecPhone) {
    showToast('Enter email or phone number', 'error');
    return;
  }
  
  // Get EC password
  const orgRef = doc(db, "organizations", orgId);
  const orgSnap = await getDoc(orgRef);
  const orgData = orgSnap.data();
  const ecPassword = orgData.ecPassword;
  
  if (!ecPassword) {
    showToast('EC password not set for this organization', 'error');
    return;
  }
  
  // Show sending status
  const statusDiv = document.getElementById('invitationStatus');
  statusDiv.classList.remove('hidden');
  statusDiv.innerHTML = `
    <div class="alert-status pending">
      <div class="alert-icon pending"><i class="fas fa-spinner fa-spin"></i></div>
      <div>
        <strong>Sending invitation...</strong>
        <div class="subtext">Please wait while we send the invitation</div>
      </div>
    </div>
  `;
  
  // Send invitation
  const result = await sendECInvitation(orgId, ecEmail, ecPhone, ecPassword);
  
  // Update status
  if (result.success) {
    statusDiv.innerHTML = `
      <div class="alert-status sent">
        <div class="alert-icon sent"><i class="fas fa-check-circle"></i></div>
        <div>
          <strong>Invitation sent successfully!</strong>
          <div class="subtext">
            ${result.email.success ? '✓ Email sent' : ''}
            ${result.sms.success ? '✓ SMS sent' : ''}
          </div>
          <p class="subtext mt-10">The EC has been notified with login credentials.</p>
        </div>
      </div>
      
      <div class="mt-20">
        <button class="btn neon-btn" onclick="closeModal('ecInviteModal'); loadSuperOrganizations();">
          <i class="fas fa-check"></i> Done
        </button>
        <button class="btn neon-btn-outline" onclick="document.getElementById('invitationStatus').classList.add('hidden')">
          Send Another
        </button>
      </div>
    `;
    
    showToast('EC invitation sent successfully!', 'success');
  } else {
    statusDiv.innerHTML = `
      <div class="alert-status failed">
        <div class="alert-icon failed"><i class="fas fa-exclamation-circle"></i></div>
        <div>
          <strong>Failed to send invitation</strong>
          <div class="subtext">${result.message}</div>
          <p class="subtext mt-10">Please check your email/SMS configuration.</p>
        </div>
      </div>
      
      <div class="mt-20">
        <button class="btn neon-btn-outline" onclick="previewECInvitation('${orgId}')">
          <i class="fas fa-redo"></i> Try Again
        </button>
        <button class="btn neon-btn" onclick="closeModal('ecInviteModal')">
          Close
        </button>
      </div>
    `;
    
    showToast('Failed to send invitation', 'error');
  }
}

// ==================== VOTER OTP & LINK FEATURES ====================

/**
 * Generate and Send OTP to Voter
 */
async function generateAndSendOTP(email, phone) {
  try {
    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    
    // Store OTP in Firebase
    const otpRef = doc(collection(db, "otps"));
    await setDoc(otpRef, {
      code: otp,
      email: email,
      phone: phone,
      orgId: currentOrgId,
      expiresAt: expiresAt,
      used: false,
      createdAt: serverTimestamp()
    });
    
    // Send OTP via email/SMS
    const sendResult = await sendOTP(email, phone, otp);
    
    if (sendResult.success) {
      return {
        success: true,
        otp: otp,
        message: 'OTP sent successfully',
        expiresAt: expiresAt
      };
    } else {
      // Clean up OTP record if sending failed
      await deleteDoc(otpRef);
      return {
        success: false,
        message: 'Failed to send OTP: ' + sendResult.message
      };
    }
    
  } catch (error) {
    console.error('Error generating OTP:', error);
    return {
      success: false,
      message: 'Failed to generate OTP: ' + error.message
    };
  }
}

/**
 * Verify OTP Code
 */
async function verifyOTP(email, phone, enteredOtp) {
  try {
    // Query OTPs for this user
    const otpsRef = collection(db, "otps");
    const q = query(
      otpsRef,
      where("email", "==", email),
      where("phone", "==", phone),
      where("used", "==", false),
      where("expiresAt", ">", new Date())
    );
    
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      return { success: false, message: 'Invalid or expired OTP' };
    }
    
    let validOtp = null;
    querySnapshot.forEach((docSnapshot) => {
      const otpData = docSnapshot.data();
      if (otpData.code === enteredOtp) {
        validOtp = docSnapshot;
      }
    });
    
    if (!validOtp) {
      return { success: false, message: 'Invalid OTP code' };
    }
    
    // Mark OTP as used
    await updateDoc(validOtp.ref, {
      used: true,
      usedAt: serverTimestamp()
    });
    
    return { success: true, message: 'OTP verified successfully' };
    
  } catch (error) {
    console.error('Error verifying OTP:', error);
    return { success: false, message: 'Error verifying OTP: ' + error.message };
  }
}

// ==================== AUTOMATED ALERTS ====================

/**
 * Check and Send Automated Alerts
 */
async function checkAndSendAutomatedAlerts() {
  try {
    const organizationsRef = collection(db, "organizations");
    const querySnapshot = await getDocs(organizationsRef);
    
    const now = new Date();
    const thirtyMinutes = 30 * 60 * 1000; // 30 minutes in milliseconds
    
    for (const docSnapshot of querySnapshot.docs) {
      const orgId = docSnapshot.id;
      const orgData = docSnapshot.data();
      
      // Check if voting is scheduled and alerts are enabled
      if (orgData.votingStatus === 'scheduled' && orgData.votingStart && orgData.sendStartAlerts) {
        const votingStart = new Date(orgData.votingStart);
        const timeUntilStart = votingStart.getTime() - now.getTime();
        
        // If voting starts in 30 minutes (+- 5 minutes buffer)
        if (timeUntilStart > 0 && timeUntilStart <= thirtyMinutes + 300000) {
          // Check if alert already sent
          const alertsRef = collection(db, "organizations", orgId, "alerts");
          const alertQuery = query(
            alertsRef,
            where("type", "==", "30min_start"),
            where("sentAt", ">", new Date(now.getTime() - 3600000)) // Last hour
          );
          
          const alertSnapshot = await getDocs(alertQuery);
          
          if (alertSnapshot.empty) {
            // Send 30-minute start alert
            await sendVotingStartAlert(orgId, orgData);
          }
        }
      }
      
      // Check for voting end alerts
      if (orgData.votingStatus === 'active' && orgData.votingEnd && orgData.sendEndAlerts) {
        const votingEnd = new Date(orgData.votingEnd);
        const timeUntilEnd = votingEnd.getTime() - now.getTime();
        
        // If voting ends in 1 hour
        if (timeUntilEnd > 0 && timeUntilEnd <= 3600000) {
          const alertsRef = collection(db, "organizations", orgId, "alerts");
          const alertQuery = query(
            alertsRef,
            where("type", "==", "1hour_end"),
            where("sentAt", ">", new Date(now.getTime() - 7200000)) // Last 2 hours
          );
          
          const alertSnapshot = await getDocs(alertQuery);
          
          if (alertSnapshot.empty) {
            // Send 1-hour end alert
            await sendVotingEndAlert(orgId, orgData);
          }
        }
      }
    }
    
  } catch (error) {
    console.error('Error checking automated alerts:', error);
  }
}

/**
 * Send Voting Start Alert to Voters
 */
async function sendVotingStartAlert(orgId, orgData) {
  try {
    // Get all voters
    const votersRef = collection(db, "organizations", orgId, "voters");
    const votersSnapshot = await getDocs(votersRef);
    
    const orgName = orgData.name || orgId;
    const startTime = new Date(orgData.votingStart).toLocaleString();
    
    for (const voterDoc of votersSnapshot.docs) {
      const voterData = voterDoc.data();
      const voterEmail = voterData.email;
      const voterPhone = voterData.phone;
      
      if (voterEmail || voterPhone) {
        // Email Content
        const emailSubject = `Voting Starts Soon - ${orgName}`;
        const emailHtmlContent = `
          <h2>🗳️ Voting Starts in 30 Minutes!</h2>
          <p>Voting for <strong>${orgName}</strong> will begin at <strong>${startTime}</strong>.</p>
          <p>Get ready to cast your vote!</p>
          <p>Your voting link: ${window.location.origin}?org=${orgId}&voter=${encodeURIComponent(voterEmail || voterPhone)}</p>
        `;
        
        const emailTextContent = `Voting for ${orgName} starts in 30 minutes (${startTime}). Get ready to vote!`;
        
        // Send alert
        if (voterEmail) {
          await sendEmail(voterEmail, emailSubject, emailHtmlContent, emailTextContent);
        }
        
        if (voterPhone && SMS_CONFIG.enabled) {
          const smsContent = `Neon Voting: ${orgName} voting starts in 30 minutes (${startTime}). Get ready!`;
          await sendSMS(voterPhone, smsContent);
        }
      }
    }
    
    // Log the alert
    await addDoc(collection(db, "organizations", orgId, "alerts"), {
      type: '30min_start',
      sentAt: serverTimestamp(),
      votersCount: votersSnapshot.size,
      startTime: orgData.votingStart
    });
    
    console.log(`30-minute start alert sent for ${orgName}`);
    
  } catch (error) {
    console.error('Error sending start alert:', error);
  }
}

/**
 * Send Voting End Alert
 */
async function sendVotingEndAlert(orgId, orgData) {
  try {
    // Similar implementation to start alert
    // Get voters who haven't voted yet
    
    const orgName = orgData.name || orgId;
    const endTime = new Date(orgData.votingEnd).toLocaleString();
    
    // Log the alert
    await addDoc(collection(db, "organizations", orgId, "alerts"), {
      type: '1hour_end',
      sentAt: serverTimestamp(),
      endTime: orgData.votingEnd
    });
    
    console.log(`1-hour end alert sent for ${orgName}`);
    
  } catch (error) {
    console.error('Error sending end alert:', error);
  }
}

// ==================== SETUP EMAILJS ====================

/**
 * Load EmailJS SDK
 */
function loadEmailJSSDK() {
  return new Promise((resolve, reject) => {
    if (typeof emailjs !== 'undefined') {
      resolve();
      return;
    }
    
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js';
    script.onload = () => {
      // Initialize EmailJS with your user ID
      if (EMAILJS_CONFIG.userId !== 'YOUR_EMAILJS_USER_ID') {
        emailjs.init(EMAILJS_CONFIG.userId);
      }
      resolve();
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

// ==================== INITIALIZATION ====================

document.addEventListener('DOMContentLoaded', async () => {
  console.log("Neon Voting System v2.3 with Email/SMS Initialized!");
  
  // Load EmailJS SDK
  try {
    await loadEmailJSSDK();
    console.log('EmailJS SDK loaded');
  } catch (error) {
    console.warn('Failed to load EmailJS SDK:', error);
  }
  
  // Setup automated alerts check (every 5 minutes)
  setInterval(checkAndSendAutomatedAlerts, 5 * 60 * 1000);
  
  // Initial alerts check
  setTimeout(checkAndSendAutomatedAlerts, 10000);
  
  // ... rest of your existing initialization code ...
});

// ==================== EXPORT FUNCTIONS ====================

// Export all functions to global scope
window.showScreen = showScreen;
window.showToast = showToast;
window.sendECInvitation = sendECInvitation;
window.sendECInvitationNow = sendECInvitationNow;
window.showECInvitationModal = showECInvitationModal;
window.previewECInvitation = previewECInvitation;
window.sendVoterLink = sendVoterLink;
window.sendBulkVoterLinks = sendBulkVoterLinks;
window.generateAndSendOTP = generateAndSendOTP;
window.verifyOTP = verifyOTP;
window.checkAndSendAutomatedAlerts = checkAndSendAutomatedAlerts;
window.sendEmail = sendEmail;
window.sendSMS = sendSMS;
window.sendOTP = sendOTP;
window.loadEmailJSSDK = loadEmailJSSDK;

// Make sure all existing functions are still exported
// ... your existing export code ...
[file content end]