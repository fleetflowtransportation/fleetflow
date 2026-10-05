import React, { useState, useEffect, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import DriverScheduleManager from './DriverScheduleManager';
import UserManagement from './UserManagement';
import VehicleManagement from './VehicleManagement';
import BookingArchive from './BookingArchive';
import SelfDriveStaffManagement from './SelfDriveStaffManagement';
import type { Tenant } from '../types';
import { googleCalendarService } from '../services/googleCalendar';
import { 
  BuildingOfficeIcon,
  ClockIcon,
  UsersIcon,
  TruckIcon,
  ArchiveIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  UserCircleIcon,
  LockClosedIcon
} from './icons/Icons';

export type SettingsSubTab = 
  | 'profile' 
  | 'portals' 
  | 'integrations' 
  | 'users' 
  | 'vehicles' 
  | 'schedule' 
  | 'self-drive' 
  | 'archive' 
  | 'account' 
  | 'danger';

export const GOOGLE_APPS_SCRIPT_CODE = `// =========================================================================
// Armada Flow Google Apps Script (Code.gs)
// Supports: Google Calendar (Create, Update, Delete), Drive & Connection Testing
// =========================================================================

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: "success",
    success: true,
    message: "Armada Flow Google Apps Script Web App is active and ready to receive requests.",
    timestamp: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var contents = e && e.postData ? e.postData.contents : "";
    var data = {};
    if (contents) {
      try {
        data = JSON.parse(contents);
      } catch (err) {
        data = {};
      }
    }
    
    // -----------------------------------------------------------------------
    // 0. ACTION: ping / testConnection
    // -----------------------------------------------------------------------
    if (data.action === "ping" || data.actionType === "ping" || data.type === "ping" || data.action === "testConnection" || !data.action) {
      var calName = "Default Calendar";
      var calendarOk = false;
      try {
        var cal = CalendarApp.getDefaultCalendar();
        if (cal) {
          calendarOk = true;
          calName = cal.getName();
        }
      } catch (errCal) {
        calName = "CalendarApp: " + errCal.toString();
      }

      var driveOk = false;
      try {
        var root = DriveApp.getRootFolder();
        if (root) driveOk = true;
      } catch (errDrive) {
        driveOk = false;
      }

      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        success: true,
        message: "Google Apps Script connection successful! Web service is ready.",
        calendar: calName,
        calendarReady: calendarOk,
        driveReady: driveOk,
        timestamp: new Date().toISOString()
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // -----------------------------------------------------------------------
    // 1. ACTION: updateCalendarEvent
    // -----------------------------------------------------------------------
    if (data.action === "updateCalendarEvent" || data.actionType === "updateCalendarEvent") {
      var calendarId = data.calendarId || "primary";
      var cal = (calendarId && calendarId !== "primary" && calendarId.indexOf("@") !== -1)
        ? (CalendarApp.getCalendarById(calendarId) || CalendarApp.getDefaultCalendar())
        : CalendarApp.getDefaultCalendar();

      var eventId = data.eventId || data.id;
      var event = null;
      if (eventId) {
        try {
          event = cal.getEventById(eventId);
        } catch (err) {}
      }

      var title = data.title || data.summary || "Armada Flow Vehicle Booking";
      var description = data.description || "";
      var location = data.location || "";
      var requesterEmail = data.requesterEmail || data.guests || data.guestEmail || "";
      
      var startStr = data.startTime || data.startIso || (data.start && data.start.dateTime);
      var endStr = data.endTime || data.endIso || (data.end && data.end.dateTime);
      var startTime = startStr ? new Date(startStr) : new Date();
      var endTime = endStr ? new Date(endStr) : new Date(startTime.getTime() + 60 * 60 * 1000);
      if (isNaN(startTime.getTime())) startTime = new Date();
      if (isNaN(endTime.getTime())) endTime = new Date(startTime.getTime() + 60 * 60 * 1000);

      if (!event && startStr) {
        var searchStart = new Date(startTime.getTime() - 24 * 60 * 60 * 1000);
        var searchEnd = new Date(endTime.getTime() + 24 * 60 * 60 * 1000);
        var list = cal.getEvents(searchStart, searchEnd);
        for (var i = 0; i < list.length; i++) {
          var desc = list[i].getDescription() || "";
          var curTitle = list[i].getTitle() || "";
          if ((data.bookingId && desc.indexOf(data.bookingId) !== -1) || curTitle === title || (data.requesterName && (curTitle.indexOf(data.requesterName) !== -1 || desc.indexOf(data.requesterName) !== -1))) {
            event = list[i];
            break;
          }
        }
      }

      if (event) {
        event.setTitle(title);
        event.setTime(startTime, endTime);
        if (description) event.setDescription(description);
        if (location) event.setLocation(location);
        if (requesterEmail && requesterEmail.indexOf("@") !== -1) {
          try {
            event.addGuest(requesterEmail);
          } catch (e) {}
        }
        
        // Dispatch update notification email
        if (requesterEmail && (data.emailHtml || data.sendEmail)) {
          try {
            MailApp.sendEmail({
              to: requesterEmail,
              subject: data.emailSubject || ("📝 Booking Updated: " + title),
              htmlBody: data.emailHtml || ("<p>Your booking <strong>" + title + "</strong> has been updated.</p>"),
              name: "Armada Flow Transport"
            });
          } catch (mErr) {}
        }

        return ContentService.createTextOutput(JSON.stringify({
          status: "success",
          success: true,
          action: "updated",
          id: event.getId(),
          title: event.getTitle()
        })).setMimeType(ContentService.MimeType.JSON);
      } else {
        // No existing calendar event found - DO NOT create a fallback event!
        // Only actual vehicle bookings should create calendar events via createCalendarEvent.
        return ContentService.createTextOutput(JSON.stringify({
          status: "success",
          success: true,
          action: "skipped_no_event",
          message: "No existing calendar event found to update."
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }

    // -----------------------------------------------------------------------
    // 2. ACTION: deleteCalendarEvent
    // -----------------------------------------------------------------------
    if (data.action === "deleteCalendarEvent" || data.actionType === "deleteCalendarEvent") {
      var calendarId = data.calendarId || "primary";
      var cal = (calendarId && calendarId !== "primary" && calendarId.indexOf("@") !== -1)
        ? (CalendarApp.getCalendarById(calendarId) || CalendarApp.getDefaultCalendar())
        : CalendarApp.getDefaultCalendar();

      var requesterEmail = data.requesterEmail || data.guests || data.guestEmail || "";
      var driverEmail = data.driverEmail || "";
      var eventId = data.eventId || data.id;
      if (eventId) {
        try {
          var event = cal.getEventById(eventId);
          if (event) {
            event.deleteEvent();
          }
        } catch (delErr) {}
      }

      // Dispatch cancellation notification email to requester
      if (requesterEmail && (data.emailHtml || data.sendEmail)) {
        try {
          MailApp.sendEmail({
            to: requesterEmail,
            subject: data.emailSubject || ("❌ Booking Cancelled: " + (data.title || "Vehicle Booking")),
            htmlBody: data.emailHtml || ("<p>Your booking for <strong>" + (data.title || "Vehicle Booking") + "</strong> has been cancelled.</p>"),
            name: "Armada Flow Transport"
          });
        } catch (mErr) {}
      }

      // Dispatch cancellation notification email to driver
      if (driverEmail && driverEmail.indexOf("@") !== -1) {
        try {
          MailApp.sendEmail({
            to: driverEmail,
            subject: "❌ Trip Cancelled: " + (data.title || "Vehicle Booking"),
            htmlBody: "<p>The trip <strong>" + (data.title || "Vehicle Booking") + "</strong> has been cancelled. Your schedule is now released.</p>",
            name: "Armada Flow Transport"
          });
        } catch (mErr) {}
      }

      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        success: true,
        action: "deleted",
        id: eventId || "done"
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // -----------------------------------------------------------------------
    // 3. ACTION: sendEmail (Direct notification dispatch)
    // -----------------------------------------------------------------------
    if (data.action === "sendEmail" || data.actionType === "sendEmail") {
      var recipient = data.to || data.recipientEmail || data.requesterEmail || data.guestEmail;
      if (recipient && recipient.indexOf("@") !== -1) {
        try {
          MailApp.sendEmail({
            to: recipient,
            subject: data.subject || "[Armada Flow] Vehicle Reservation Notice",
            htmlBody: data.html || data.htmlBody || ("<pre>" + (data.body || data.text || "Booking notification") + "</pre>"),
            name: "Armada Flow Transport"
          });
          return ContentService.createTextOutput(JSON.stringify({
            status: "success",
            success: true,
            message: "Email sent to " + recipient
          })).setMimeType(ContentService.MimeType.JSON);
        } catch (sendErr) {
          return ContentService.createTextOutput(JSON.stringify({
            status: "error",
            success: false,
            error: sendErr.toString()
          })).setMimeType(ContentService.MimeType.JSON);
        }
      }
    }

    // -----------------------------------------------------------------------
    // 4. ACTION: createCalendarEvent (Only for vehicle bookings)
    // -----------------------------------------------------------------------
    if (data.action === "createCalendarEvent" || data.actionType === "createCalendarEvent" || data.action === "createEvent" || data.actionType === "createEvent") {
      var calendarId = data.calendarId || "primary";
      var cal = (calendarId && calendarId !== "primary" && calendarId.indexOf("@") !== -1)
        ? (CalendarApp.getCalendarById(calendarId) || CalendarApp.getDefaultCalendar())
        : CalendarApp.getDefaultCalendar();

      var title = data.title || data.summary || ("Vehicle Booking - " + (data.requesterName || "User"));
      var description = data.description || "";
      var location = data.location || "";
      var requesterEmail = data.requesterEmail || data.guestEmail || "";
      var driverEmail = data.driverEmail || "";
      
      var startStr = data.startTime || data.startIso || (data.start && data.start.dateTime);
      var endStr = data.endTime || data.endIso || (data.end && data.end.dateTime);
      var startTime = startStr ? new Date(startStr) : new Date();
      var endTime = endStr ? new Date(endStr) : new Date(startTime.getTime() + 60 * 60 * 1000);
      if (isNaN(startTime.getTime())) startTime = new Date();
      if (isNaN(endTime.getTime())) endTime = new Date(startTime.getTime() + 60 * 60 * 1000);

      // Build unique guest emails list for calendar invites
      var guestList = [];
      if (data.guests && typeof data.guests === 'string') {
        guestList = data.guests.split(',').map(function(s) { return s.trim(); }).filter(function(s) { return s.indexOf('@') !== -1; });
      } else {
        if (requesterEmail && requesterEmail.indexOf("@") !== -1) guestList.push(requesterEmail);
        if (driverEmail && driverEmail.indexOf("@") !== -1) guestList.push(driverEmail);
      }
      guestList = guestList.filter(function(item, pos) { return guestList.indexOf(item) === pos; });

      var eventOptions = {
        description: description,
        location: location,
        sendInvites: true
      };
      if (guestList.length > 0) {
        eventOptions.guests = guestList.join(',');
      }

      var createdEvent = cal.createEvent(title, startTime, endTime, eventOptions);

      // 1. Dispatch confirmation HTML email to Requester
      if (requesterEmail && (data.emailHtml || data.sendEmail)) {
        try {
          MailApp.sendEmail({
            to: requesterEmail,
            subject: data.emailSubject || ("✅ Booking Confirmed: " + title),
            htmlBody: data.emailHtml || ("<p>Your vehicle reservation <strong>" + title + "</strong> has been confirmed.</p>"),
            name: "Armada Flow Transport"
          });
        } catch (mailErr) {
          Logger.log("Requester MailApp error: " + mailErr.toString());
        }
      }

      // 2. Dispatch duty notification HTML email to Driver
      if (driverEmail && driverEmail.indexOf("@") !== -1) {
        try {
          MailApp.sendEmail({
            to: driverEmail,
            subject: data.driverEmailSubject || ("🚐 New Trip Assignment: " + title),
            htmlBody: data.driverEmailHtml || data.emailHtml || ("<p>You have been assigned to trip: <strong>" + title + "</strong></p>"),
            name: "Armada Flow Transport"
          });
        } catch (driverErr) {
          Logger.log("Driver MailApp error: " + driverErr.toString());
        }
      }

      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        success: true,
        action: "created",
        id: createdEvent.getId(),
        title: createdEvent.getTitle()
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // -----------------------------------------------------------------------
    // 5. ACTION: uploadFile / Save to Google Drive (with subfolder: vehicle, fuel_logs, etc.)
    // -----------------------------------------------------------------------
    if (data.action === "uploadFile" || data.actionType === "uploadFile" || (data.base64 && !data.action)) {
      var rootFolderId = data.driveId || data.folderId || "";
      var targetFolder = null;

      if (rootFolderId && rootFolderId !== "primary") {
        try {
          targetFolder = DriveApp.getFolderById(rootFolderId);
        } catch (errF) {
          targetFolder = DriveApp.getRootFolder();
        }
      } else {
        targetFolder = DriveApp.getRootFolder();
      }

      // Route to dedicated subfolder / nested path (e.g. 'Fuel Logs/VAA 8821' or array of subFolders)
      var pathInput = data.folderPath || data.subFolderPath || data.folder || data.folderName || data.subFolder || "vehicle";
      if (pathInput) {
        var segments = Array.isArray(pathInput) ? pathInput : String(pathInput).split('/').map(function(s) { return s.trim(); }).filter(Boolean);
        for (var si = 0; si < segments.length; si++) {
          var segName = segments[si];
          if (!segName) continue;
          var subFolders = targetFolder.getFoldersByName(segName);
          if (subFolders.hasNext()) {
            targetFolder = subFolders.next();
          } else {
            targetFolder = targetFolder.createFolder(segName);
          }
        }
      }

      var base64Data = data.base64;
      var fileName = data.fileName || ("upload_" + new Date().getTime());
      var mimeType = data.mimeType || "application/octet-stream";

      var decodedBlob = Utilities.newBlob(Utilities.base64Decode(base64Data), mimeType, fileName);
      var createdFile = targetFolder.createFile(decodedBlob);

      try {
        createdFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      } catch (shareErr) {}

      var fileId = createdFile.getId();
      var directUrl = "https://lh3.googleusercontent.com/d/" + fileId;
      var fileUrl = createdFile.getUrl();

      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        success: true,
        action: "uploadFile",
        fileId: fileId,
        id: fileId,
        url: directUrl,
        directUrl: directUrl,
        webViewLink: fileUrl,
        name: createdFile.getName(),
        folder: Array.isArray(pathInput) ? pathInput.join('/') : String(pathInput),
        size: createdFile.getSize()
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // -----------------------------------------------------------------------
    // 6. ACTION: deleteFile / Remove from Google Drive (Trashes the file)
    // -----------------------------------------------------------------------
    if (data.action === "deleteFile" || data.actionType === "deleteFile") {
      var fileIdToDelete = data.fileId || data.id;
      if (fileIdToDelete) {
        try {
          var fileObj = DriveApp.getFileById(fileIdToDelete);
          if (fileObj) {
            fileObj.setTrashed(true);
          }
          return ContentService.createTextOutput(JSON.stringify({
            status: "success",
            success: true,
            action: "deleteFile",
            fileId: fileIdToDelete,
            message: "File successfully removed to trash"
          })).setMimeType(ContentService.MimeType.JSON);
        } catch (delFileErr) {
          return ContentService.createTextOutput(JSON.stringify({
            status: "error",
            success: false,
            message: delFileErr.toString()
          })).setMimeType(ContentService.MimeType.JSON);
        }
      }
    }

    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      success: true,
      id: createdEvent.getId(),
      title: createdEvent.getTitle(),
      guestsInvited: guestList
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      success: false,
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}`;

export interface SettingsViewProps {
  initialSubTab?: string;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ initialSubTab = 'profile' }) => {
  const [activeTab, setActiveTab] = useState<SettingsSubTab>(initialSubTab as SettingsSubTab);
  const { 
    activeTenant, 
    updateTenantProfile, 
    updateTenantGoogleIntegrations, 
    deleteTenantCompletely, 
    currentUser, 
    updateUser, 
    logout,
    users, 
    vehicles, 
    bookings, 
    driverSchedules, 
    selfDriveStaff 
  } = useAppContext();

  useEffect(() => {
    if (initialSubTab) {
      setActiveTab(initialSubTab as SettingsSubTab);
    }
  }, [initialSubTab]);

  // Guard: Restrict Integrations to Super Admin only
  useEffect(() => {
    if (activeTab === 'integrations' && !currentUser?.isOwner) {
      setActiveTab('profile');
    }
  }, [activeTab, currentUser]);

  // Counts for sidebar badges
  const archivedCount = useMemo(() => 
    bookings.filter(b => b.status === 'Completed' || b.status === 'Cancelled' || b.status === 'Rejected').length, 
    [bookings]
  );

  // -------------------------------------------------------------
  // TAB 1: Organization Profile State & Handlers
  // -------------------------------------------------------------
  const [profileForm, setProfileForm] = useState<Partial<Tenant>>({
    companyName: '',
    regNumber: '',
    email: '',
    phone: '',
    website: '',
    address: '',
    postcode: '',
    city: '',
    state: '',
    picName: '',
    picPhone: '',
    operatingHours: '08:00 - 17:00 (Mon - Fri)',
    timezone: 'Asia/Kuala_Lumpur',
  });

  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const isProfileDirtyRef = React.useRef(false);
  const prevTenantIdRef = React.useRef<string | null>(null);

  useEffect(() => {
    if (!activeTenant) return;
    // Only update form if organization ID changed or user has not made uncommitted edits
    if (prevTenantIdRef.current !== activeTenant.id || !isProfileDirtyRef.current) {
      prevTenantIdRef.current = activeTenant.id;
      setProfileForm({
        companyName: activeTenant.companyName || activeTenant.name || '',
        regNumber: activeTenant.regNumber || '',
        email: activeTenant.email || '',
        phone: activeTenant.phone || '',
        website: activeTenant.website || '',
        address: activeTenant.address || '',
        postcode: activeTenant.postcode || '',
        city: activeTenant.city || '',
        state: activeTenant.state || '',
        picName: activeTenant.picName || '',
        picPhone: activeTenant.picPhone || '',
        operatingHours: activeTenant.operatingHours || '08:00 - 17:00 (Mon - Fri)',
        timezone: activeTenant.timezone || 'Asia/Kuala_Lumpur',
      });
    }
  }, [activeTenant]);

  const handleProfileChange = (key: keyof Tenant, val: string) => {
    isProfileDirtyRef.current = true;
    setProfileForm(prev => ({ ...prev, [key]: val }));
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaving(true);
    setProfileError(null);
    setProfileSuccess(false);

    try {
      const payload: Partial<Tenant> = {
        ...profileForm,
        name: profileForm.companyName || activeTenant?.name || 'Organization',
      };
      const ok = await updateTenantProfile(payload);
      if (ok) {
        isProfileDirtyRef.current = false;
        setProfileSuccess(true);
        setTimeout(() => setProfileSuccess(false), 4000);
      } else {
        setProfileError('Failed to save changes. Please try again.');
      }
    } catch (err: any) {
      setProfileError(err.message || 'An error occurred while saving organization profile.');
    } finally {
      setProfileSaving(false);
    }
  };

  // -------------------------------------------------------------
  // TAB 2: Public Portals & Links
  // -------------------------------------------------------------
  const tenantIdParam = activeTenant?.id || '';
  const origin = window.location.origin;
  const bookingPortalUrl = `${origin}/?action=book&tenant_id=${tenantIdParam}`;
  const odometerPortalUrl = `${origin}/?action=odometer&tenant_id=${tenantIdParam}`;
  const calendarPortalUrl = `${origin}/?action=calendar&tenant_id=${tenantIdParam}`;

  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [qrModalData, setQrModalData] = useState<{ title: string; subtitle: string; url: string } | null>(null);

  const copyToClipboard = (url: string, key: string) => {
    navigator.clipboard.writeText(url);
    setCopiedLink(key);
    setTimeout(() => setCopiedLink(null), 2500);
  };

  const handleDownloadQr = () => {
    if (!qrModalData) return;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 600;
    canvas.height = 760;

    // Background white
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Outer border
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 4;
    ctx.strokeRect(16, 16, canvas.width - 32, canvas.height - 32);

    // Header banner background
    ctx.fillStyle = '#4f46e5'; // Indigo
    ctx.fillRect(16, 16, canvas.width - 32, 100);

    // Header text: Organization / Fleet Flow
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(activeTenant?.name ? `${activeTenant.name} • Fleet Portal` : 'Fleet Management Portal', canvas.width / 2, 55);

    ctx.font = '13px system-ui, sans-serif';
    ctx.fillStyle = '#c7d2fe';
    ctx.fillText('SCAN WITH MOBILE PHONE CAMERA', canvas.width / 2, 82);

    // Portal Title
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillText(qrModalData.title, canvas.width / 2, 155);

    // Subtitle
    ctx.fillStyle = '#64748b';
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText(qrModalData.subtitle, canvas.width / 2, 180);

    // Load QR Code image
    const qrImg = new Image();
    qrImg.crossOrigin = 'anonymous';
    qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=350x350&data=${encodeURIComponent(qrModalData.url)}`;
    qrImg.onload = () => {
      // Draw QR box background
      ctx.fillStyle = '#f8fafc';
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(130, 205, 340, 340, 20);
      ctx.fill();
      ctx.stroke();

      // Draw QR image inside
      ctx.drawImage(qrImg, 155, 230, 290, 290);

      // URL box at bottom
      ctx.fillStyle = '#f1f5f9';
      ctx.beginPath();
      ctx.roundRect(40, 580, 520, 75, 12);
      ctx.fill();

      ctx.fillStyle = '#334155';
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.fillText('DIRECT WEB LINK:', canvas.width / 2, 608);

      ctx.fillStyle = '#4f46e5';
      ctx.font = '12px monospace';
      const maxLen = 65;
      const displayUrl = qrModalData.url.length > maxLen ? qrModalData.url.substring(0, maxLen) + '...' : qrModalData.url;
      ctx.fillText(displayUrl, canvas.width / 2, 632);

      // Footer brand
      ctx.fillStyle = '#94a3b8';
      ctx.font = '11px system-ui, sans-serif';
      ctx.fillText('Powered by Armada Flow Fleet Management System', canvas.width / 2, 705);

      // Trigger download
      const link = document.createElement('a');
      link.download = `${qrModalData.title.toLowerCase().replace(/[^a-z0-9]/g, '_')}_qr_card.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
  };

  // -------------------------------------------------------------
  // TAB 3: Integrations & Cloud Sync
  // -------------------------------------------------------------
  const [integrationForm, setIntegrationForm] = useState({
    calendarId: '',
    appsScriptUrl: '',
    driveId: ''
  });
  const [integrationSaving, setIntegrationSaving] = useState(false);
  const [integrationSuccess, setIntegrationSuccess] = useState(false);
  const [integrationError, setIntegrationError] = useState<string | null>(null);

  const isIntegrationDirtyRef = React.useRef(false);
  const prevIntegrationTenantIdRef = React.useRef<string | null>(null);

  useEffect(() => {
    if (!activeTenant) return;
    if (prevIntegrationTenantIdRef.current !== activeTenant.id || !isIntegrationDirtyRef.current) {
      prevIntegrationTenantIdRef.current = activeTenant.id;
      setIntegrationForm({
        calendarId: activeTenant.googleCalendarId || '',
        appsScriptUrl: activeTenant.googleAppsScriptUrl || '',
        driveId: activeTenant.googleDriveId || ''
      });
    }
  }, [activeTenant]);

  const handleIntegrationChange = (key: 'calendarId' | 'appsScriptUrl' | 'driveId', val: string) => {
    isIntegrationDirtyRef.current = true;
    setIntegrationForm(prev => ({ ...prev, [key]: val }));
  };

  const handleIntegrationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIntegrationSaving(true);
    setIntegrationSuccess(false);
    setIntegrationError(null);

    try {
      const ok = await updateTenantGoogleIntegrations({
        googleCalendarId: integrationForm.calendarId.trim(),
        googleAppsScriptUrl: integrationForm.appsScriptUrl.trim(),
        googleDriveId: integrationForm.driveId.trim()
      });
      if (ok) {
        isIntegrationDirtyRef.current = false;
        setIntegrationSuccess(true);
        setTimeout(() => setIntegrationSuccess(false), 4000);
      } else {
        setIntegrationError('Failed to save integration settings.');
      }
    } catch (err: any) {
      setIntegrationError(err.message || 'An error occurred while saving integrations.');
    } finally {
      setIntegrationSaving(false);
    }
  };

  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; data?: any } | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);
  const [showScriptCode, setShowScriptCode] = useState(true);

  const handleTestConnection = async () => {
    if (!activeTenant) return;
    setTestingConnection(true);
    setTestResult(null);
    try {
      const targetUrl = integrationForm.appsScriptUrl.trim();
      if (!targetUrl) {
        setTestResult({
          success: false,
          message: 'Please enter a Google Apps Script Webhook URL above first.'
        });
        return;
      }
      const res = await googleCalendarService.testConnection(activeTenant, targetUrl);
      setTestResult(res);
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Connection test failed. Check webhook deployment.'
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_CODE);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2500);
  };

  // -------------------------------------------------------------
  // TAB 4: Account & Security (My Profile)
  // -------------------------------------------------------------
  const [passwordForm, setPasswordForm] = useState({
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);

    if (passwordForm.newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters long.');
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('Passwords do not match. Please verify and re-enter.');
      return;
    }

    if (!currentUser?.id) {
      setPasswordError('No active user session found.');
      return;
    }

    setPasswordSaving(true);
    try {
      updateUser(currentUser.id, { password: passwordForm.newPassword.trim() });
      setPasswordSuccess(true);
      setPasswordForm({ newPassword: '', confirmPassword: '' });
      setTimeout(() => setPasswordSuccess(false), 4000);
    } catch (err: any) {
      setPasswordError(err.message || 'Failed to update password.');
    } finally {
      setPasswordSaving(false);
    }
  };

  // -------------------------------------------------------------
  // TAB 5: Danger Zone (Organization Deletion)
  // -------------------------------------------------------------
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDeleteOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeleteError(null);

    const actualId = activeTenant?.id;
    if (!actualId) return;

    if (deleteConfirmText.trim().toUpperCase() !== 'DELETE') {
      setDeleteError('Please type the exact confirmation word "DELETE".');
      return;
    }

    setDeleteLoading(true);
    try {
      const ok = await deleteTenantCompletely(actualId);
      if (ok) {
        alert('Your organization and all associated fleet data have been permanently deleted.');
        logout();
      } else {
        setDeleteError('Failed to delete organization. Please check database permissions.');
      }
    } catch (err: any) {
      setDeleteError(err.message || 'An error occurred during deletion.');
    } finally {
      setDeleteLoading(false);
    }
  };

  // -------------------------------------------------------------
  // Sidebar Navigation Structure
  // -------------------------------------------------------------
  const navSections = [
    {
      group: 'Organization',
      items: [
        { id: 'profile', label: 'General Profile', icon: <BuildingOfficeIcon className="w-4 h-4" /> },
        { id: 'portals', label: 'Public Portals & Links', icon: <DocumentTextIcon className="w-4 h-4" /> },
        ...(currentUser?.isOwner ? [
          { id: 'integrations', label: 'Integrations & Sync', icon: <ClockIcon className="w-4 h-4" /> }
        ] : []),
      ]
    },
    {
      group: 'Fleet Operations',
      items: [
        { id: 'users', label: 'Users & Drivers', icon: <UsersIcon className="w-4 h-4" />, badge: users.length },
        { id: 'vehicles', label: 'Fleet Vehicles', icon: <TruckIcon className="w-4 h-4" />, badge: vehicles.length },
        { id: 'schedule', label: 'Driver Rosters', icon: <ClockIcon className="w-4 h-4" />, badge: driverSchedules.length || undefined },
        { id: 'self-drive', label: 'Self-Drive Staff', icon: <DocumentTextIcon className="w-4 h-4" />, badge: selfDriveStaff.length || undefined },
        { id: 'archive', label: 'Booking Archive', icon: <ArchiveIcon className="w-4 h-4" />, badge: archivedCount || undefined },
      ]
    },
    {
      group: 'Security & Access',
      items: [
        { id: 'account', label: 'My Account', icon: <UserCircleIcon className="w-4 h-4" /> },
        ...(currentUser?.isOwner ? [
          { id: 'danger', label: 'Danger Zone', icon: <LockClosedIcon className="w-4 h-4 text-rose-500" /> }
        ] : [])
      ]
    }
  ];

  return (
    <div className="w-full space-y-6">
      {/* Page Header */}
      <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">System Settings</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-slate-100 text-slate-700 border border-slate-200">
              {activeTenant?.companyName || activeTenant?.name || 'Organization'}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Configure organization preferences, public booking links, fleet resources, and account security.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Operational
          </span>
        </div>
      </div>

      {/* Main Grid: Left Nav + Right Content Area */}
      <div className="flex flex-col md:flex-row gap-6 items-start">
        
        {/* Left Side Navigation */}
        <aside className="w-full md:w-64 flex-shrink-0 bg-white rounded-2xl p-3 shadow-xs border border-slate-200">
          <nav className="space-y-5">
            {navSections.map((section, sIdx) => (
              <div key={sIdx} className="space-y-1">
                <p className="px-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  {section.group}
                </p>
                <div className="space-y-0.5">
                  {section.items.map((item) => {
                    const isActive = activeTab === item.id;
                    const isDanger = item.id === 'danger';
                    return (
                      <button
                        key={item.id}
                        onClick={() => setActiveTab(item.id as SettingsSubTab)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer text-left ${
                          isActive
                            ? isDanger
                              ? 'bg-rose-50 text-rose-700 border border-rose-200 shadow-xs'
                              : 'bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-xs'
                            : isDanger
                            ? 'text-rose-600 hover:bg-rose-50/60'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          <span className={isActive ? (isDanger ? 'text-rose-600' : 'text-indigo-600') : 'text-slate-400'}>
                            {item.icon}
                          </span>
                          <span className="truncate">{item.label}</span>
                        </div>
                        {item.badge !== undefined && (
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ml-2 ${
                            isActive ? 'bg-indigo-200/80 text-indigo-800' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {item.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </aside>

        {/* Right Main Content Pane */}
        <main className="flex-1 w-full min-w-0">
          
          {/* TAB 1: General Organization Profile */}
          {activeTab === 'profile' && (
            <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-6 space-y-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Organization Profile</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Official identity, registration numbers, and physical operational office details.
                </p>
              </div>

              {profileSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-800 flex items-center gap-2">
                  <CheckCircleIcon className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  Organization details updated successfully.
                </div>
              )}

              {profileError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-800">
                  ⚠️ {profileError}
                </div>
              )}

              <form onSubmit={handleProfileSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Organization / Company Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={profileForm.companyName || ''}
                      onChange={(e) => handleProfileChange('companyName', e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                      placeholder="e.g. Yayasan Chow Kit"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Registration / ROC Number
                    </label>
                    <input
                      type="text"
                      value={profileForm.regNumber || ''}
                      onChange={(e) => handleProfileChange('regNumber', e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                      placeholder="e.g. PPM-012-14-12345678"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Official Contact Email <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      value={profileForm.email || ''}
                      onChange={(e) => handleProfileChange('email', e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                      placeholder="e.g. info@organization.org"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Contact Phone Number
                    </label>
                    <input
                      type="tel"
                      value={profileForm.phone || ''}
                      onChange={(e) => handleProfileChange('phone', e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition font-mono"
                      placeholder="e.g. +603-4043 2345"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Operating Address
                  </label>
                  <textarea
                    rows={2}
                    value={profileForm.address || ''}
                    onChange={(e) => handleProfileChange('address', e.target.value)}
                    className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                    placeholder="Physical headquarters or dispatch center address"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      City
                    </label>
                    <input
                      type="text"
                      value={profileForm.city || ''}
                      onChange={(e) => handleProfileChange('city', e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                      placeholder="Kuala Lumpur"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Postcode
                    </label>
                    <input
                      type="text"
                      value={profileForm.postcode || ''}
                      onChange={(e) => handleProfileChange('postcode', e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition font-mono"
                      placeholder="50350"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      State / Region
                    </label>
                    <input
                      type="text"
                      value={profileForm.state || ''}
                      onChange={(e) => handleProfileChange('state', e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                      placeholder="Wilayah Persekutuan"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Person-in-Charge (PIC)
                    </label>
                    <input
                      type="text"
                      value={profileForm.picName || ''}
                      onChange={(e) => handleProfileChange('picName', e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                      placeholder="Transport Coordinator Name"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Operating Hours
                    </label>
                    <input
                      type="text"
                      value={profileForm.operatingHours || ''}
                      onChange={(e) => handleProfileChange('operatingHours', e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                      placeholder="08:00 - 17:00 (Mon - Fri)"
                    />
                  </div>
                </div>

                <div className="pt-3 flex justify-end">
                  <button
                    type="submit"
                    disabled={profileSaving}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm transition shadow-xs disabled:opacity-50 cursor-pointer"
                  >
                    {profileSaving ? 'Saving Changes...' : 'Save Organization Profile'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 2: Public Portals & Links */}
          {activeTab === 'portals' && (
            <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-6 space-y-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Public Links & Shareable Portals</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Share these URLs with your staff members, program officers, and drivers for fast self-service access.
                </p>
              </div>

              <div className="space-y-4">
                {/* Portal 1: Public Booking Form */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">1. Staff Booking Portal</h3>
                      <p className="text-xs text-slate-500">Allow employees and staff to request vehicles without logging in.</p>
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                      Public Form
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={bookingPortalUrl}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono bg-white text-slate-600 outline-none select-all"
                    />
                    <button
                      onClick={() => copyToClipboard(bookingPortalUrl, 'book')}
                      className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer"
                    >
                      {copiedLink === 'book' ? '✓ Copied' : 'Copy Link'}
                    </button>
                    <button
                      onClick={() => setQrModalData({
                        title: '1. Staff Booking Portal',
                        subtitle: 'Allow employees and staff to request vehicles without logging in.',
                        url: bookingPortalUrl
                      })}
                      className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer flex items-center gap-1.5"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                      </svg>
                      <span>QR Code</span>
                    </button>
                    <a
                      href={bookingPortalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition whitespace-nowrap"
                    >
                      Open ↗
                    </a>
                  </div>
                </div>

                {/* Portal 2: Self-Drive Odometer Portal */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">2. Self-Drive Mileage & Odometer Submission</h3>
                      <p className="text-xs text-slate-500">Fast mobile portal for drivers to submit odometer readings before and after trips.</p>
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                      Driver Tool
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={odometerPortalUrl}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono bg-white text-slate-600 outline-none select-all"
                    />
                    <button
                      onClick={() => copyToClipboard(odometerPortalUrl, 'odo')}
                      className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer"
                    >
                      {copiedLink === 'odo' ? '✓ Copied' : 'Copy Link'}
                    </button>
                    <button
                      onClick={() => setQrModalData({
                        title: '2. Self-Drive Mileage & Odometer Submission',
                        subtitle: 'Fast mobile portal for drivers to submit odometer readings before and after trips.',
                        url: odometerPortalUrl
                      })}
                      className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer flex items-center gap-1.5"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                      </svg>
                      <span>QR Code</span>
                    </button>
                    <a
                      href={odometerPortalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition whitespace-nowrap"
                    >
                      Open ↗
                    </a>
                  </div>
                </div>

                {/* Portal 3: Live Calendar Schedule */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">3. Live Vehicle Availability Calendar</h3>
                      <p className="text-xs text-slate-500">Read-only overview showing active bookings and upcoming fleet reservations.</p>
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-100">
                      Read-Only
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={calendarPortalUrl}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono bg-white text-slate-600 outline-none select-all"
                    />
                    <button
                      onClick={() => copyToClipboard(calendarPortalUrl, 'cal')}
                      className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer"
                    >
                      {copiedLink === 'cal' ? '✓ Copied' : 'Copy Link'}
                    </button>
                    <button
                      onClick={() => setQrModalData({
                        title: '3. Live Vehicle Availability Calendar',
                        subtitle: 'Read-only overview showing active bookings and upcoming fleet reservations.',
                        url: calendarPortalUrl
                      })}
                      className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer flex items-center gap-1.5"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                      </svg>
                      <span>QR Code</span>
                    </button>
                    <a
                      href={calendarPortalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition whitespace-nowrap"
                    >
                      Open ↗
                    </a>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* QR Code Modal */}
          {qrModalData && (
            <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200 p-6 text-center space-y-5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div className="text-left">
                    <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider block">
                      Scan & Access Portal
                    </span>
                    <h3 className="text-base font-black text-slate-900">
                      {qrModalData.title}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setQrModalData(null)}
                    className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                <p className="text-xs text-slate-500">
                  {qrModalData.subtitle}
                </p>

                {/* QR Code Image Card */}
                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 inline-block mx-auto shadow-inner">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrModalData.url)}`}
                    alt="QR Code"
                    className="w-48 h-48 sm:w-56 sm:h-56 mx-auto rounded-xl object-contain bg-white p-2 border border-slate-200 shadow-sm"
                  />
                </div>

                <div className="space-y-2">
                  <input
                    type="text"
                    readOnly
                    value={qrModalData.url}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono bg-slate-50 text-slate-600 outline-none select-all text-center"
                  />
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleDownloadQr}
                    className="flex-1 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    <span>Download QR Card</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const printWindow = window.open('', '_blank');
                      if (printWindow) {
                        printWindow.document.write(`
                          <html>
                            <head>
                              <title>QR Code - ${qrModalData.title}</title>
                              <style>
                                body { font-family: system-ui, sans-serif; text-align: center; padding: 40px; color: #1e293b; }
                                .card { max-width: 400px; margin: 0 auto; border: 2px solid #cbd5e1; border-radius: 24px; padding: 32px; background: #fff; box-shadow: 0 10px 25px rgba(0,0,0,0.05); }
                                h2 { font-size: 20px; font-weight: 800; margin-bottom: 4px; color: #0f172a; }
                                p { font-size: 13px; color: #64748b; margin-bottom: 24px; }
                                img { width: 260px; height: 260px; object-fit: contain; margin-bottom: 20px; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px; }
                                .url { font-size: 11px; font-family: monospace; color: #475569; background: #f1f5f9; padding: 10px; border-radius: 8px; word-break: break-all; }
                              </style>
                            </head>
                            <body>
                              <div class="card">
                                <h2>${qrModalData.title}</h2>
                                <p>${qrModalData.subtitle}</p>
                                <img src="https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(qrModalData.url)}" />
                                <div class="url">${qrModalData.url}</div>
                              </div>
                              <script>
                                window.onload = function() { window.print(); };
                              </script>
                            </body>
                          </html>
                        `);
                        printWindow.document.close();
                      }
                    }}
                    className="flex-1 py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                    </svg>
                    <span>Print QR Card</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Integrations & Cloud Sync (Super Admin Only) */}
          {activeTab === 'integrations' && (
            !currentUser?.isOwner ? (
              <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-8 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 mx-auto flex items-center justify-center font-bold text-lg">
                  🔒
                </div>
                <h2 className="text-base font-bold text-slate-900">Super Admin Access Only</h2>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Google Calendar, Drive, and Cloud Sync configurations are restricted and can only be accessed by the Super Admin.
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-6 space-y-6">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-slate-900">Google Calendar, Drive & Cloud Sync</h2>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                      👑 Super Admin
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Synchronize vehicle reservations to Google Calendar and attach inspection sheets to your organization Google Drive.
                  </p>
                </div>

                {integrationSuccess && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-800 flex items-center gap-2">
                    <CheckCircleIcon className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    Integration settings saved successfully.
                  </div>
                )}

                {integrationError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-800">
                    ⚠️ {integrationError}
                  </div>
                )}

                <form onSubmit={handleIntegrationSubmit} className="space-y-4">
                  {/* Google Calendar ID */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Google Calendar ID
                    </label>
                    <input
                      type="text"
                      value={integrationForm.calendarId}
                      onChange={(e) => handleIntegrationChange('calendarId', e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                      placeholder="e.g. c_1234567890@group.calendar.google.com or primary"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">
                      Enter your Google Calendar ID or leave as "primary" to write events to your default organization calendar.
                    </p>
                  </div>

                  {/* Google Drive Folder ID / Link */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                        Google Drive Folder Link / ID
                      </label>
                      {integrationForm.driveId && (
                        <a
                          href={
                            integrationForm.driveId.startsWith('http')
                              ? integrationForm.driveId
                              : `https://drive.google.com/drive/folders/${integrationForm.driveId}`
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold"
                        >
                          Open Drive Folder ↗
                        </a>
                      )}
                    </div>
                    <input
                      type="text"
                      value={integrationForm.driveId}
                      onChange={(e) => handleIntegrationChange('driveId', e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                      placeholder="e.g. 1A2b3C4d5E6F... or https://drive.google.com/drive/folders/..."
                    />
                    <p className="text-[11px] text-slate-400 mt-1">
                      Google Drive folder ID or shareable link to store vehicle inspection sheets, fuel receipts, and trip logs.
                    </p>
                  </div>

                  {/* Google Apps Script Webhook Endpoint */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Google Apps Script Webhook Endpoint
                    </label>
                    <input
                      type="url"
                      value={integrationForm.appsScriptUrl}
                      onChange={(e) => handleIntegrationChange('appsScriptUrl', e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                      placeholder="https://script.google.com/macros/s/.../exec"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">
                      Automated webhook endpoint syncing approved dispatch notices and booking reminders to staff.
                    </p>
                  </div>

                  <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={handleTestConnection}
                      disabled={testingConnection}
                      className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-sm transition border border-slate-200 disabled:opacity-50 cursor-pointer"
                    >
                      {testingConnection ? 'Testing Connection...' : '🔌 Test Webhook Connection'}
                    </button>
                    <button
                      type="submit"
                      disabled={integrationSaving}
                      className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm transition shadow-xs disabled:opacity-50 cursor-pointer"
                    >
                      {integrationSaving ? 'Saving...' : 'Save Integration Settings'}
                    </button>
                  </div>
                </form>

                {/* Connection Test Result */}
                {testResult && (
                  <div className={`p-4 rounded-xl border text-xs space-y-1 ${
                    testResult.success 
                      ? 'bg-emerald-50 text-emerald-900 border-emerald-200' 
                      : 'bg-rose-50 text-rose-900 border-rose-200'
                  }`}>
                    <div className="flex items-center gap-2 font-bold text-sm">
                      <span>{testResult.success ? '✅ Webhook Connected Successfully' : '❌ Webhook Connection Failed'}</span>
                    </div>
                    <p className="leading-relaxed">{testResult.message}</p>
                    {testResult.data && (
                      <p className="text-[11px] text-slate-600 font-mono mt-1">
                        Calendar: {testResult.data.calendar || 'Active'} | Drive Ready: {testResult.data.driveReady ? 'Yes' : 'No'}
                      </p>
                    )}
                  </div>
                )}

                <div className="border-t border-slate-200 pt-6 space-y-4">
                  {/* Google Apps Script Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                        <span>Google Apps Script (Code.gs) Source Code</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                          Official Webhook
                        </span>
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Copy this complete script into your Google Apps Script project to automate Google Calendar & Drive synchronization.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleCopyCode}
                        className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer whitespace-nowrap"
                      >
                        <DocumentTextIcon className="w-4 h-4" />
                        {codeCopied ? '✓ Copied to Clipboard!' : 'Copy Code.gs Script'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowScriptCode(!showScriptCode)}
                        className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition border border-slate-200 cursor-pointer whitespace-nowrap"
                      >
                        {showScriptCode ? 'Hide Code' : 'View Code'}
                      </button>
                    </div>
                  </div>

                  {/* Step-by-Step Instructions */}
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs text-slate-600">
                    <p className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">How to deploy to Google Apps Script:</p>
                    <ol className="list-decimal list-inside space-y-1.5 pl-1 leading-relaxed">
                      <li>
                        Open <a href="https://script.google.com" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline font-bold">script.google.com ↗</a> and create a <strong>New Project</strong>.
                      </li>
                      <li>Delete all existing placeholder code in the <code>Code.gs</code> editor.</li>
                      <li>Click the <strong>Copy Code.gs Script</strong> button above and paste the entire script into the editor.</li>
                      <li>Click <strong>Deploy &gt; New deployment</strong>, select type <strong>Web app</strong>.</li>
                      <li>Set <strong>Execute as:</strong> <em>Me (your Google email)</em> and <strong>Who has access:</strong> <em>Anyone</em>.</li>
                      <li>Click <strong>Deploy</strong>, grant required permissions, copy the resulting <strong>Web App URL</strong>, and paste it into the <strong>Google Apps Script Webhook Endpoint</strong> field above.</li>
                    </ol>
                  </div>

                  {/* Code Block */}
                  {showScriptCode && (
                    <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-900 text-slate-100 font-mono text-xs shadow-inner">
                      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-950/80 border-b border-slate-800 text-[11px] text-slate-400">
                        <span className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80 inline-block"></span>
                          <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block"></span>
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block"></span>
                          <span className="ml-1 font-semibold text-slate-300">Code.gs</span>
                        </span>
                        <button
                          type="button"
                          onClick={handleCopyCode}
                          className="hover:text-white transition font-semibold text-indigo-400 cursor-pointer"
                        >
                          {codeCopied ? '✓ Copied' : 'Copy'}
                        </button>
                      </div>
                      <pre className="p-4 overflow-x-auto max-h-96 text-[11px] leading-relaxed select-all">
                        {GOOGLE_APPS_SCRIPT_CODE}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            )
          )}

          {/* TAB 4: Users & Drivers */}
          {activeTab === 'users' && <UserManagement />}

          {/* TAB 5: Vehicles */}
          {activeTab === 'vehicles' && <VehicleManagement />}

          {/* TAB 6: Driver Rosters / Schedules */}
          {activeTab === 'schedule' && (
            <div className="space-y-4">
              <DriverScheduleManager readOnly={false} />
            </div>
          )}

          {/* TAB 7: Self-Drive Staff */}
          {activeTab === 'self-drive' && <SelfDriveStaffManagement />}

          {/* TAB 8: Booking Archive */}
          {activeTab === 'archive' && <BookingArchive />}

          {/* TAB 9: My Account & Security */}
          {activeTab === 'account' && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-6 space-y-6">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">My Account Profile</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Your authenticated personal administrator profile details.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <div>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Full Name</p>
                    <p className="text-sm font-bold text-slate-900 mt-0.5">{currentUser?.name || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Assigned Role</p>
                    <div className="mt-1">
                      {currentUser?.isOwner ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                          👑 Super Admin
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                          🛡️ Administrator
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Change Password Form */}
              <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-6 space-y-6">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Change Password</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Update your account credentials to keep your administrator session secure.
                  </p>
                </div>

                {passwordSuccess && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-800 flex items-center gap-2">
                    <CheckCircleIcon className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    Your password has been successfully updated.
                  </div>
                )}

                {passwordError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-800">
                    ⚠️ {passwordError}
                  </div>
                )}

                <form onSubmit={handlePasswordSubmit} className="space-y-4 max-w-lg">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      New Password
                    </label>
                    <input
                      type="password"
                      required
                      value={passwordForm.newPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                      placeholder="Minimum 6 characters"
                      className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      required
                      value={passwordForm.confirmPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                      placeholder="Re-enter new password"
                      className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                    />
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={passwordSaving}
                      className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm transition shadow-xs disabled:opacity-50 cursor-pointer"
                    >
                      {passwordSaving ? 'Updating...' : 'Update Password'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* TAB 10: Danger Zone (Super Admin only) */}
          {activeTab === 'danger' && currentUser?.isOwner && (
            <div className="bg-white rounded-2xl shadow-xs border border-rose-200 p-6 space-y-6">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-rose-50 rounded-xl text-rose-600 border border-rose-100 flex-shrink-0">
                  <LockClosedIcon className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-rose-700">Danger Zone: Delete Organization</h2>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Permanently delete this organization, including all registered vehicles, bookings, odometer logs, 
                    fuel records, and secondary administrator accounts. This action is irreversible.
                  </p>
                </div>
              </div>

              {deleteError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-800">
                  ⚠️ {deleteError}
                </div>
              )}

              <form onSubmit={handleDeleteOrganization} className="space-y-4 max-w-md pt-2 border-t border-slate-100">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Type <span className="text-rose-600 font-mono">DELETE</span> to confirm:
                  </label>
                  <input
                    type="text"
                    required
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    placeholder="DELETE"
                    className="w-full border border-rose-300 rounded-xl px-3.5 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-rose-500 transition"
                  />
                </div>

                <button
                  type="submit"
                  disabled={deleteLoading || deleteConfirmText.trim().toUpperCase() !== 'DELETE'}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-sm transition shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {deleteLoading ? 'Purging Organization...' : 'Permanently Delete Organization'}
                </button>
              </form>
            </div>
          )}

        </main>
      </div>
    </div>
  );
};

export default SettingsView;
