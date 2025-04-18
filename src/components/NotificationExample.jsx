import React, { useState } from 'react';
import { useNotification } from '../context/NotificationContext';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Slider } from './ui/slider';

const NotificationExample = () => {
  const { addNotification, showSuccess, showError, showInfo } = useNotification();
  const [message, setMessage] = useState('Custom notification message');
  const [duration, setDuration] = useState(5000);
  const [isLoading, setIsLoading] = useState(false);

  const handleCustomNotification = (type) => {
    addNotification(message, type, duration);
  };

  const handlePermanentNotification = () => {
    // Use a large number for the duration to make it effectively permanent until closed
    addNotification(`${message} (click X to dismiss)`, 'info', 999999999);
  };
  
  const simulateAsyncOperation = () => {
    setIsLoading(true);
    
    setTimeout(() => {
      showSuccess('Operation completed successfully!');
      setIsLoading(false);
    }, 2000);
  };

  return (
    <div className="space-y-6">
      <div className="p-4 border rounded-md bg-card">
        <h2 className="text-lg font-semibold mb-4">Notification Examples</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <Button 
            onClick={() => showSuccess('File saved successfully!')}
            variant="default"
            className="w-full"
          >
            Show Success
          </Button>
          
          <Button 
            onClick={() => showError('Failed to load document. Please try again.')}
            variant="destructive"
            className="w-full"
          >
            Show Error
          </Button>
          
          <Button 
            onClick={() => showInfo('Your document will auto-save every 5 minutes.')}
            variant="outline"
            className="w-full"
          >
            Show Info
          </Button>
        </div>
      </div>

      <div className="p-4 border rounded-md bg-card">
        <h2 className="text-lg font-semibold mb-4">Custom Notification</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Message</label>
            <Input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Enter notification message"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">
              Duration: {duration / 1000}s
            </label>
            <Slider
              min={1000}
              max={10000}
              step={1000}
              value={[duration]}
              onValueChange={(value) => setDuration(value[0])}
              className="mb-4"
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <Button 
              onClick={() => handleCustomNotification('success')}
              variant="default"
              className="w-full"
            >
              Custom Success
            </Button>
            
            <Button 
              onClick={() => handleCustomNotification('error')}
              variant="destructive"
              className="w-full"
            >
              Custom Error
            </Button>
            
            <Button 
              onClick={() => handleCustomNotification('info')}
              variant="outline"
              className="w-full"
            >
              Custom Info
            </Button>
            
            <Button 
              onClick={handlePermanentNotification}
              variant="secondary"
              className="w-full"
            >
              Permanent
            </Button>
          </div>
        </div>
      </div>
      
      <div className="p-4 border rounded-md bg-card">
        <h2 className="text-lg font-semibold mb-4">Loading State Example</h2>
        <div className="flex space-x-4">
          <Button 
            onClick={simulateAsyncOperation}
            isLoading={isLoading}
            loadingText="Processing..."
            variant="default"
          >
            Start Process
          </Button>
          
          <Button 
            variant="outline"
            isLoading={isLoading}
          >
            Loading Button
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NotificationExample; 