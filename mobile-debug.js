// Debug script for mobile functionality
console.log('=== MOBILE DEBUG SCRIPT LOADED ===');

// Check if elements exist
function checkElements() {
  const elements = {
    'mobile-toggles': document.getElementById('mobile-toggles'),
    'menu-collapse-btn': document.getElementById('menu-collapse-btn'),
    'mobile-status-indicator': document.getElementById('mobile-status-indicator'),
    'toggle-info': document.getElementById('toggle-info'),
    'toggle-search': document.getElementById('toggle-search'),
    'toggle-year': document.getElementById('toggle-year'),
    'toggle-rotation': document.getElementById('toggle-rotation'),
    'toggle-ai': document.getElementById('toggle-ai'),
    'info': document.getElementById('info'),
    'search-bar-container': document.getElementById('search-bar-container'),
    'ai-explanation-container': document.getElementById('ai-explanation-container')
  };
  
  console.log('Elements check:');
  Object.entries(elements).forEach(([name, element]) => {
    console.log(`- ${name}: ${element ? '✓ found' : '✗ missing'}`);
    if (element) {
      const styles = window.getComputedStyle(element);
      console.log(`  Display: ${styles.display}, Visibility: ${styles.visibility}`);
    }
  });
  
  return elements;
}

// Simple mobile toggle setup
function setupSimpleMobileToggles() {
  console.log('Setting up simple mobile toggles...');
  
  const elements = checkElements();
  
  if (!elements['mobile-toggles']) {
    console.error('Mobile toggles container not found!');
    return;
  }
  
  // Force show mobile toggles on small screens
  if (window.innerWidth <= 768) {
    elements['mobile-toggles'].style.display = 'flex';
    console.log('Forced mobile toggles to display: flex');
  }
  
  // Find dynamic elements (year slider and rotation controls)
  function findDynamicElements() {
    let yearContainer = null;
    let rotationContainer = null;
    
    // Find year slider container
    const allDivs = document.querySelectorAll('div');
    for (let div of allDivs) {
      if (div.textContent && div.textContent.includes('Year:') && div.querySelector('input[type="range"]')) {
        yearContainer = div;
        div.classList.add('year-slider-container');
        console.log('Found year slider container');
        break;
      }
    }
    
    // Find rotation controls container
    for (let div of allDivs) {
      if (div.textContent && div.textContent.includes('Earth Rotation Speed')) {
        rotationContainer = div;
        div.classList.add('rotation-controls');
        console.log('Found rotation controls container');
        break;
      }
    }
    
    return { yearContainer, rotationContainer };
  }
  
  const dynamicElements = findDynamicElements();
  
  // Complete toggle functionality for all buttons
  const toggleMappings = {
    'toggle-info': elements['info'],
    'toggle-search': elements['search-bar-container'], 
    'toggle-ai': elements['ai-explanation-container'],
    'toggle-year': dynamicElements.yearContainer,
    'toggle-rotation': dynamicElements.rotationContainer
  };
  
  // Function to update status indicator
  function updateStatusIndicator() {
    const statusIndicator = elements['mobile-status-indicator']?.querySelector('#active-controls-count');
    if (!statusIndicator) return;
    
    let activeCount = 0;
    Object.keys(toggleMappings).forEach(buttonId => {
      const button = document.getElementById(buttonId);
      if (button && button.classList.contains('active')) {
        activeCount++;
      }
    });
    
    statusIndicator.textContent = activeCount;
    console.log(`Status updated: ${activeCount} active controls`);
  }

  Object.entries(toggleMappings).forEach(([buttonId, targetElement]) => {
    const button = document.getElementById(buttonId);
    
    if (button && targetElement) {
      // Remove any existing listeners
      button.replaceWith(button.cloneNode(true));
      const freshButton = document.getElementById(buttonId);
      
      freshButton.addEventListener('click', () => {
        const isHidden = targetElement.classList.contains('mobile-hidden');
        
        if (isHidden) {
          targetElement.classList.remove('mobile-hidden');
          freshButton.classList.add('active');
          freshButton.classList.remove('hidden');
          console.log(`✓ Showed ${buttonId} target`);
        } else {
          targetElement.classList.add('mobile-hidden');
          freshButton.classList.remove('active');
          freshButton.classList.add('hidden');
          console.log(`✓ Hidden ${buttonId} target`);
        }
        
        updateStatusIndicator();
      });
      
      console.log(`✓ Set up toggle for ${buttonId}`);
    } else {
      console.warn(`✗ Missing elements for ${buttonId}:`, {
        button: !!button,
        target: !!targetElement
      });
    }
  });
  
  // Show All / Hide All functionality
  const showAllBtn = elements['mobile-status-indicator']?.querySelector('#show-all-btn');
  const hideAllBtn = elements['mobile-status-indicator']?.querySelector('#hide-all-btn');
  
  if (showAllBtn) {
    showAllBtn.addEventListener('click', () => {
      Object.entries(toggleMappings).forEach(([buttonId, targetElement]) => {
        const button = document.getElementById(buttonId);
        if (button && targetElement) {
          targetElement.classList.remove('mobile-hidden');
          button.classList.add('active');
          button.classList.remove('hidden');
        }
      });
      updateStatusIndicator();
      console.log('✓ Showed all controls');
    });
  }
  
  if (hideAllBtn) {
    hideAllBtn.addEventListener('click', () => {
      Object.entries(toggleMappings).forEach(([buttonId, targetElement]) => {
        const button = document.getElementById(buttonId);
        if (button && targetElement) {
          targetElement.classList.add('mobile-hidden');
          button.classList.remove('active');
          button.classList.add('hidden');
        }
      });
      updateStatusIndicator();
      console.log('✓ Hidden all controls');
    });
  }

  // Menu collapse functionality
  const menuBtn = elements['menu-collapse-btn'];
  const togglesContainer = elements['mobile-toggles'];
  
  if (menuBtn && togglesContainer) {
    let isOpen = true;
    
    menuBtn.addEventListener('click', () => {
      isOpen = !isOpen;
      
      if (isOpen) {
        togglesContainer.classList.remove('collapsed');
        menuBtn.classList.remove('menu-open');
        menuBtn.innerHTML = '📱';
        console.log('✓ Menu opened');
      } else {
        togglesContainer.classList.add('collapsed');
        menuBtn.classList.add('menu-open');
        menuBtn.innerHTML = '✕';
        console.log('✓ Menu collapsed');
      }
    });
    
    console.log('✓ Set up menu collapse functionality');
  }
  
  // Initial status update
  updateStatusIndicator();
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded - initializing mobile debug');
    setTimeout(setupSimpleMobileToggles, 500);
  });
} else {
  console.log('DOM already loaded - initializing mobile debug immediately');
  setTimeout(setupSimpleMobileToggles, 500);
}

// Also try after a longer delay
setTimeout(() => {
  console.log('=== DELAYED MOBILE DEBUG CHECK ===');
  checkElements();
  setupSimpleMobileToggles();
}, 2000);

console.log('Mobile debug script setup complete');