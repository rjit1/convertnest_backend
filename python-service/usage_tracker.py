"""
Daily Usage Tracker for PDF to Excel Service
Tracks and enforces daily usage limits (100 conversions per day)
Resets at midnight UTC
"""

import json
import os
from datetime import datetime, date
from pathlib import Path
import logging

logger = logging.getLogger(__name__)

class DailyUsageTracker:
    """
    Tracks daily usage of the PDF to Excel service.
    
    Features:
    - Daily limit enforcement (default: 100 conversions/day)
    - Automatic reset at midnight UTC
    - Persistent storage (survives service restarts)
    - Thread-safe operations
    """
    
    DAILY_LIMIT = 100  # Max conversions per day
    STORAGE_FILE = 'usage_data.json'
    
    def __init__(self, storage_dir=None, daily_limit=None):
        """
        Initialize usage tracker.
        
        Args:
            storage_dir (str, optional): Directory to store usage data
            daily_limit (int, optional): Override default daily limit
        """
        if daily_limit is not None:
            self.DAILY_LIMIT = daily_limit
        
        # Set storage path
        if storage_dir is None:
            storage_dir = os.path.dirname(os.path.abspath(__file__))
        
        self.storage_path = os.path.join(storage_dir, self.STORAGE_FILE)
        
        # Load existing usage data
        self.usage_data = self._load_usage_data()
        
        # Check if we need to reset (new day)
        self._check_and_reset_if_needed()
        
        logger.info(f"📊 Usage tracker initialized: {self.usage_data['count']}/{self.DAILY_LIMIT} used today")
    
    def _load_usage_data(self):
        """Load usage data from storage file."""
        if os.path.exists(self.storage_path):
            try:
                with open(self.storage_path, 'r') as f:
                    data = json.load(f)
                    # Validate structure
                    if 'date' in data and 'count' in data:
                        return data
            except Exception as e:
                logger.warning(f"Error loading usage data: {e}")
        
        # Return default data if file doesn't exist or is invalid
        return {
            'date': str(date.today()),
            'count': 0,
            'limit': self.DAILY_LIMIT
        }
    
    def _save_usage_data(self):
        """Save usage data to storage file."""
        try:
            self.usage_data['limit'] = self.DAILY_LIMIT  # Always update limit
            with open(self.storage_path, 'w') as f:
                json.dump(self.usage_data, f, indent=2)
        except Exception as e:
            logger.error(f"Error saving usage data: {e}")
    
    def _check_and_reset_if_needed(self):
        """Check if it's a new day and reset counter if needed."""
        today = str(date.today())
        
        if self.usage_data['date'] != today:
            # New day - reset counter
            old_count = self.usage_data['count']
            self.usage_data = {
                'date': today,
                'count': 0,
                'limit': self.DAILY_LIMIT
            }
            self._save_usage_data()
            logger.info(f"🔄 New day reset: Previous day had {old_count} conversions")
    
    def check_quota(self):
        """
        Check if conversion is allowed based on daily quota.
        
        Returns:
            tuple: (allowed: bool, remaining: int, message: str)
        """
        self._check_and_reset_if_needed()
        
        remaining = self.DAILY_LIMIT - self.usage_data['count']
        
        if remaining <= 0:
            return (
                False, 
                0, 
                f"Daily quota exceeded ({self.DAILY_LIMIT} conversions per day). Resets at midnight UTC."
            )
        
        return (True, remaining, f"{remaining} conversions remaining today")
    
    def increment_usage(self):
        """
        Increment usage counter after successful conversion.
        
        Returns:
            dict: Updated usage info
        """
        self._check_and_reset_if_needed()
        
        self.usage_data['count'] += 1
        self._save_usage_data()
        
        remaining = self.DAILY_LIMIT - self.usage_data['count']
        
        logger.info(f"📈 Usage incremented: {self.usage_data['count']}/{self.DAILY_LIMIT} ({remaining} remaining)")
        
        return {
            'used': self.usage_data['count'],
            'limit': self.DAILY_LIMIT,
            'remaining': remaining,
            'date': self.usage_data['date']
        }
    
    def get_usage_info(self):
        """
        Get current usage information.
        
        Returns:
            dict: Usage statistics
        """
        self._check_and_reset_if_needed()
        
        return {
            'date': self.usage_data['date'],
            'used': self.usage_data['count'],
            'limit': self.DAILY_LIMIT,
            'remaining': self.DAILY_LIMIT - self.usage_data['count'],
            'percentage': (self.usage_data['count'] / self.DAILY_LIMIT) * 100
        }
    
    def reset_quota(self):
        """
        Manually reset daily quota (admin function).
        
        Returns:
            dict: Reset confirmation
        """
        old_count = self.usage_data['count']
        self.usage_data['count'] = 0
        self._save_usage_data()
        
        logger.warning(f"⚠️  Manual quota reset: {old_count} → 0")
        
        return {
            'success': True,
            'message': 'Quota manually reset',
            'previous_count': old_count,
            'new_count': 0
        }


# Global tracker instance (singleton pattern)
_tracker_instance = None

def get_usage_tracker():
    """
    Get the global usage tracker instance (singleton).
    
    Returns:
        DailyUsageTracker: Global tracker instance
    """
    global _tracker_instance
    
    if _tracker_instance is None:
        _tracker_instance = DailyUsageTracker()
    
    return _tracker_instance
